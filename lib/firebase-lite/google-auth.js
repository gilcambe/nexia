'use strict';
// ADR-FREE-01: credencial de service account → access token do Google (OAuth 2.0 JWT bearer),
// assinado com Web Crypto (funciona no Node 20 e no Cloudflare Worker, sem firebase-admin).
// O token fica em memória até 5 minutos antes de expirar. A chave privada nunca sai daqui.

const SCOPES = [
  'https://www.googleapis.com/auth/datastore',
  'https://www.googleapis.com/auth/identitytoolkit',
  'https://www.googleapis.com/auth/cloud-platform',
].join(' ');

const b64url = buf => Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

function pemToDer(pem) {
  const body = String(pem).replace(/-----(BEGIN|END) [A-Z ]+-----/g, '').replace(/\s+/g, '');
  return Buffer.from(body, 'base64');
}

async function signRS256(privateKeyPem, data) {
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(privateKeyPem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(data)));
}

/**
 * @param {{ client_email: string, private_key: string, token_uri?: string }} sa
 * @param {{ fetchImpl?: typeof fetch, now?: () => number }} [o]
 */
function createTokenSource(sa, { fetchImpl = (...a) => fetch(...a), now = () => Date.now() } = {}) {
  if (!sa || !sa.client_email || !sa.private_key) throw new Error('Service account sem client_email/private_key.');
  const tokenUri = sa.token_uri || 'https://oauth2.googleapis.com/token';
  let cached = null;
  let inflight = null;

  async function fetchToken() {
    const iat = Math.floor(now() / 1000);
    const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claims = b64url(JSON.stringify({ iss: sa.client_email, scope: SCOPES, aud: tokenUri, iat, exp: iat + 3600 }));
    const sig = b64url(await signRS256(sa.private_key, `${header}.${claims}`));
    const r = await fetchImpl(tokenUri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${claims}.${sig}` }).toString(),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) {
      const e = new Error(`Google OAuth respondeu ${r.status}${j.error ? ` (${j.error})` : ''}.`);
      e.code = 'auth/invalid-credential';
      throw e;
    }
    cached = { token: j.access_token, until: now() + (Number(j.expires_in) || 3600) * 1000 - 5 * 60 * 1000 };
    return cached.token;
  }

  return {
    async getToken() {
      if (cached && now() < cached.until) return cached.token;
      if (!inflight) inflight = fetchToken().finally(() => { inflight = null; });
      return inflight;
    },
  };
}

module.exports = { createTokenSource, signRS256, b64url, pemToDer };
