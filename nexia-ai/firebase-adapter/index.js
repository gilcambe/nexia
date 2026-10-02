'use strict';
// Firebase Adapter (spec §10). Somente leitura nesta fase: dados do projeto Firebase e
// estado de Hosting, regras (Firestore/Storage), Firestore e Cloud Functions. Não assume
// que todo projeto usa todos os produtos: produto sem acesso ou não usado aparece como
// { used: false }, sem derrubar o resto.
//
// Credencial: JSON de service account (somente leitura recomendada: papel "Firebase
// Viewer") numa variável do servidor referenciada pela Integration. O servidor assina um
// JWT RS256 e troca por um access token de 1 h (escopos de leitura). Nada é gravado.
const crypto = require('crypto');
const { GatewayError, CODES } = require('../tool-gateway/errors');

const SCOPES = 'https://www.googleapis.com/auth/firebase.readonly https://www.googleapis.com/auth/cloud-platform.read-only';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const PROJECT_RE = /^[a-z][a-z0-9-]{4,29}$/;
const b64url = b => Buffer.from(b).toString('base64url');

function parseServiceAccount(raw) {
  let sa;
  try { sa = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { sa = null; }
  if (!sa || sa.type !== 'service_account' || !sa.client_email || !sa.private_key) throw new GatewayError(CODES.PROVIDER_AUTH, 'Credencial Firebase inválida (esperado JSON de service account).');
  try { return { email: sa.client_email, key: crypto.createPrivateKey(String(sa.private_key).replace(/\\n/g, '\n')) }; }
  catch { throw new GatewayError(CODES.PROVIDER_AUTH, 'Credencial Firebase inválida (chave privada).'); }
}

/**
 * @param {{ projectId: string, credential: string, fetchImpl?, now?: () => number }} o
 */
function createFirebaseAdapter({ projectId, credential, fetchImpl = (...a) => fetch(...a), now = () => Date.now() }) {
  if (!PROJECT_RE.test(String(projectId))) throw new GatewayError(CODES.INVALID_INPUT, 'external_ref da integração Firebase não é um id de projeto válido.');
  const sa = parseServiceAccount(credential);
  let cached = null;

  async function token() {
    if (cached && cached.expires - 5 * 60 * 1000 > now()) return cached.token;
    const iat = Math.floor(now() / 1000);
    const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const body = b64url(JSON.stringify({ iss: sa.email, scope: SCOPES, aud: TOKEN_URL, iat, exp: iat + 3600 }));
    const jwt = `${head}.${body}.${b64url(crypto.sign('RSA-SHA256', Buffer.from(`${head}.${body}`), sa.key))}`;
    let r;
    try {
      r = await fetchImpl(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }).toString(), signal: AbortSignal.timeout(20000) });
    } catch { throw new GatewayError(CODES.UPSTREAM, 'Google indisponível.'); }
    if (!r.ok) throw new GatewayError(CODES.PROVIDER_AUTH, `Google recusou a credencial Firebase (${r.status}).`);
    const d = await r.json();
    cached = { token: d.access_token, expires: now() + (Number(d.expires_in) || 3600) * 1000 };
    return cached.token;
  }

  async function get(url) {
    let r;
    try { r = await fetchImpl(url, { headers: { Authorization: `Bearer ${await token()}`, Accept: 'application/json' }, signal: AbortSignal.timeout(20000) }); }
    catch (e) { if (e instanceof GatewayError) throw e; throw new GatewayError(CODES.UPSTREAM, 'Google indisponível.'); }
    if (r.status === 403 || r.status === 404) return { missing: r.status };
    if (!r.ok) throw new GatewayError(CODES.UPSTREAM, `Google respondeu ${r.status}.`, { status: r.status });
    return r.json();
  }

  // Cada produto isolado: falha de um não derruba os outros.
  async function product(fn) {
    try { return await fn(); }
    catch (e) { return { used: null, error: e instanceof GatewayError ? e.code : 'UPSTREAM' }; }
  }
  const p = encodeURIComponent(projectId);

  return {
    projectId,
    async getProject() {
      const d = await get(`https://firebase.googleapis.com/v1beta1/projects/${p}`);
      if (d.missing) throw new GatewayError(CODES.UPSTREAM_NOT_FOUND, 'Projeto Firebase não encontrado ou sem acesso para esta credencial.');
      const res = d.resources || {};
      return { project_id: d.projectId, display_name: d.displayName, state: d.state,
        resources: { hosting_site: res.hostingSite || null, storage_bucket: res.storageBucket || null, realtime_database: res.realtimeDatabaseInstance || null, location: res.locationId || null } };
    },

    async getStatus() {
      const [hosting, rules, firestore, functions] = await Promise.all([
        product(async () => {
          const d = await get(`https://firebasehosting.googleapis.com/v1beta1/projects/${p}/sites`);
          if (d.missing || !(d.sites || []).length) return { used: false };
          const sites = await Promise.all(d.sites.slice(0, 5).map(async s => {
            const site = String(s.name).split('/').pop();
            const rel = await get(`https://firebasehosting.googleapis.com/v1beta1/sites/${encodeURIComponent(site)}/releases?pageSize=1`);
            const last = (rel.releases || [])[0];
            return { site, default_url: s.defaultUrl || null,
              last_release: last ? { time: last.releaseTime, type: last.type, version_status: last.version && last.version.status, message: last.message ? String(last.message).slice(0, 200) : null } : null };
          }));
          return { used: true, sites };
        }),
        product(async () => {
          const d = await get(`https://firebaserules.googleapis.com/v1/projects/${p}/releases`);
          if (d.missing) return { used: false };
          const rel = (d.releases || []).map(r => ({ name: String(r.name).split('/releases/')[1], ruleset: String(r.rulesetName || '').split('/').pop(), updated: r.updateTime }));
          return { used: rel.length > 0, releases: rel.slice(0, 20) };
        }),
        product(async () => {
          const d = await get(`https://firestore.googleapis.com/v1/projects/${p}/databases`);
          if (d.missing) return { used: false };
          const dbs = (d.databases || []).map(x => ({ name: String(x.name).split('/').pop(), type: x.type, location: x.locationId }));
          return { used: dbs.length > 0, databases: dbs };
        }),
        product(async () => {
          const d = await get(`https://cloudfunctions.googleapis.com/v2/projects/${p}/locations/-/functions?pageSize=100`);
          if (d.missing) return { used: false };
          const fns = (d.functions || []).map(f => ({ name: String(f.name).split('/').pop(), state: f.state, environment: f.environment, updated: f.updateTime }));
          return { used: fns.length > 0, total: fns.length, failing: fns.filter(f => f.state && f.state !== 'ACTIVE').length, functions: fns.slice(0, 50) };
        }),
      ]);
      return { project_id: projectId, hosting, rules, firestore, functions };
    },
  };
}

module.exports = { createFirebaseAdapter, parseServiceAccount, PROJECT_RE };
