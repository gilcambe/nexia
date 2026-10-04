'use strict';
// ADR-FREE-01: Firebase Auth sem firebase-admin.
//  - verifyIdToken: confere a assinatura RS256 do ID token com as chaves públicas do Google
//    (Web Crypto), além de aud, iss, exp, iat e sub, como o Admin SDK faz.
//  - getUser / updateUser / setCustomUserClaims: API REST do Identity Toolkit.
// No emulador do Auth (FIREBASE_AUTH_EMULATOR_HOST) os tokens não são assinados; como o
// Admin SDK, só a assinatura deixa de ser conferida.

const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const CLOCK_SKEW_S = 300;

class AuthError extends Error {
  constructor(code, message) { super(message); this.name = 'FirebaseAuthError'; this.code = code; }
}

const b64urlDecode = s => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const parseJson = (buf, what) => {
  try { return JSON.parse(Buffer.from(buf).toString('utf8')); } catch { throw new AuthError('auth/argument-error', `${what} do token inválido.`); }
};

function createAuth({ projectId, emulatorHost, getToken, fetchImpl = (...a) => fetch(...a), now = () => Date.now() }) {
  if (!projectId) throw new Error('Auth: projectId ausente.');
  let jwks = null; // { keys: Map(kid → CryptoKey), until }

  async function publicKey(kid) {
    if (!jwks || now() > jwks.until || !jwks.raw.has(kid)) {
      const r = await fetchImpl(JWKS_URL);
      if (!r.ok) throw new AuthError('auth/internal-error', `Chaves públicas do Google indisponíveis (${r.status}).`);
      const body = await r.json();
      const maxAge = Number((/max-age=(\d+)/.exec(r.headers.get('cache-control') || '') || [])[1]) || 3600;
      jwks = { raw: new Map((body.keys || []).map(k => [k.kid, k])), keys: new Map(), until: now() + maxAge * 1000 };
    }
    const jwk = jwks.raw.get(kid);
    if (!jwk) throw new AuthError('auth/invalid-id-token', 'Token assinado com chave desconhecida.');
    if (!jwks.keys.has(kid)) {
      jwks.keys.set(kid, await crypto.subtle.importKey('jwk', { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']));
    }
    return jwks.keys.get(kid);
  }

  async function verifyIdToken(idToken) {
    if (typeof idToken !== 'string' || idToken.split('.').length !== 3) throw new AuthError('auth/argument-error', 'ID token malformado.');
    const [h, p, s] = idToken.split('.');
    const header = parseJson(b64urlDecode(h), 'Cabeçalho');
    const payload = parseJson(b64urlDecode(p), 'Conteúdo');
    if (!emulatorHost) {
      if (header.alg !== 'RS256' || !header.kid) throw new AuthError('auth/invalid-id-token', 'Algoritmo do token inválido.');
      const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', await publicKey(header.kid), b64urlDecode(s), new TextEncoder().encode(`${h}.${p}`));
      if (!ok) throw new AuthError('auth/invalid-id-token', 'Assinatura do token inválida.');
    }
    const t = Math.floor(now() / 1000);
    if (payload.aud !== projectId) throw new AuthError('auth/invalid-id-token', 'Token de outro projeto (aud).');
    if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw new AuthError('auth/invalid-id-token', 'Emissor do token inválido (iss).');
    if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 128) throw new AuthError('auth/invalid-id-token', 'Token sem usuário (sub).');
    if (typeof payload.exp !== 'number' || payload.exp <= t) throw new AuthError('auth/id-token-expired', 'Token expirado.');
    if (typeof payload.iat !== 'number' || payload.iat > t + CLOCK_SKEW_S) throw new AuthError('auth/invalid-id-token', 'Token emitido no futuro (iat).');
    return { ...payload, uid: payload.sub };
  }

  const apiBase = emulatorHost
    ? `http://${emulatorHost}/identitytoolkit.googleapis.com/v1/projects/${projectId}`
    : `https://identitytoolkit.googleapis.com/v1/projects/${projectId}`;

  async function call(path, body) {
    const token = emulatorHost ? 'owner' : await getToken();
    const r = await fetchImpl(`${apiBase}/${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = (j.error && j.error.message) || `Identity Toolkit respondeu ${r.status}.`;
      throw new AuthError(/USER_NOT_FOUND/.test(msg) ? 'auth/user-not-found' : 'auth/internal-error', msg);
    }
    return j;
  }

  const toUserRecord = u => ({
    uid: u.localId,
    email: u.email,
    emailVerified: !!u.emailVerified,
    displayName: u.displayName,
    photoURL: u.photoUrl,
    phoneNumber: u.phoneNumber,
    disabled: !!u.disabled,
    customClaims: u.customAttributes ? JSON.parse(u.customAttributes) : undefined,
    metadata: { creationTime: u.createdAt ? new Date(Number(u.createdAt)).toUTCString() : undefined,
      lastSignInTime: u.lastLoginAt ? new Date(Number(u.lastLoginAt)).toUTCString() : undefined },
  });

  async function getUser(uid) {
    const j = await call('accounts:lookup', { localId: [uid] });
    if (!j.users || !j.users.length) throw new AuthError('auth/user-not-found', 'Usuário não encontrado.');
    return toUserRecord(j.users[0]);
  }

  async function updateUser(uid, props = {}) {
    const body = { localId: uid };
    if (props.email !== undefined) body.email = props.email;
    if (props.emailVerified !== undefined) body.emailVerified = !!props.emailVerified;
    if (props.password !== undefined) body.password = props.password;
    if (props.displayName !== undefined) body.displayName = props.displayName;
    if (props.disabled !== undefined) body.disableUser = !!props.disabled;
    await call('accounts:update', body);
    return getUser(uid);
  }

  async function setCustomUserClaims(uid, claims) {
    await call('accounts:update', { localId: uid, customAttributes: JSON.stringify(claims || {}) });
  }

  return { verifyIdToken, getUser, updateUser, setCustomUserClaims };
}

module.exports = { createAuth, AuthError };
