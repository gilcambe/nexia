'use strict';
// Google (OAuth + APIs do Firebase) e Cloudflare falsos em memória para a Fase 9.
// Cada um é um fetchImpl; combineFetch encaminha por host. Nada sai da máquina.
const crypto = require('crypto');

const json = (status, body) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function createFakeGoogle({ projectId = 'cliente-alfa', products = { hosting: true, rules: true, firestore: true, functions: false } } = {}) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const serviceAccount = JSON.stringify({ type: 'service_account', project_id: projectId, client_email: `viewer@${projectId}.iam.gserviceaccount.com`,
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) });
  const tokens = new Map();
  const calls = [];
  const hosts = ['oauth2.googleapis.com', 'firebase.googleapis.com', 'firebasehosting.googleapis.com', 'firebaserules.googleapis.com', 'firestore.googleapis.com', 'cloudfunctions.googleapis.com'];

  async function fetchImpl(url, opts = {}) {
    const u = new URL(url);
    calls.push({ host: u.host, path: u.pathname });
    if (u.host === 'oauth2.googleapis.com' && u.pathname === '/token') {
      const assertion = new URLSearchParams(opts.body).get('assertion') || '';
      const [h, p, s] = assertion.split('.');
      const ok = s && crypto.verify('RSA-SHA256', Buffer.from(`${h}.${p}`), publicKey, Buffer.from(s, 'base64url'));
      if (!ok) return json(400, { error: 'invalid_grant' });
      const claims = JSON.parse(Buffer.from(p, 'base64url').toString());
      const token = `ya29.fake-${crypto.randomBytes(12).toString('hex')}`;
      tokens.set(token, claims.scope);
      return json(200, { access_token: token, expires_in: 3599, token_type: 'Bearer' });
    }
    const auth = String((opts.headers || {}).Authorization || '').replace('Bearer ', '');
    if (!tokens.has(auth)) return json(401, { error: { code: 401 } });
    const p = u.pathname;
    if (u.host === 'firebase.googleapis.com' && p === `/v1beta1/projects/${projectId}`) {
      return json(200, { projectId, displayName: 'Cliente Alfa', state: 'ACTIVE', resources: { hostingSite: projectId, storageBucket: `${projectId}.appspot.com`, locationId: 'southamerica-east1' } });
    }
    if (u.host === 'firebasehosting.googleapis.com') {
      if (!products.hosting) return json(403, {});
      if (p === `/v1beta1/projects/${projectId}/sites`) return json(200, { sites: [{ name: `projects/${projectId}/sites/${projectId}`, defaultUrl: `https://${projectId}.web.app` }] });
      if (p === `/v1beta1/sites/${projectId}/releases`) return json(200, { releases: [{ releaseTime: '2026-10-01T12:00:00Z', type: 'DEPLOY', message: 'v1.2', version: { status: 'FINALIZED' } }] });
    }
    if (u.host === 'firebaserules.googleapis.com' && p === `/v1/projects/${projectId}/releases`) {
      return products.rules ? json(200, { releases: [{ name: `projects/${projectId}/releases/cloud.firestore`, rulesetName: `projects/${projectId}/rulesets/abc`, updateTime: '2026-09-30T10:00:00Z' }] }) : json(403, {});
    }
    if (u.host === 'firestore.googleapis.com' && p === `/v1/projects/${projectId}/databases`) {
      return products.firestore ? json(200, { databases: [{ name: `projects/${projectId}/databases/(default)`, type: 'FIRESTORE_NATIVE', locationId: 'southamerica-east1' }] }) : json(403, {});
    }
    if (u.host === 'cloudfunctions.googleapis.com') return products.functions ? json(200, { functions: [{ name: 'projects/x/locations/y/functions/api', state: 'ACTIVE', environment: 'GEN_2', updateTime: '2026-09-29T00:00:00Z' }] }) : json(403, {});
    return json(404, {});
  }
  return { fetchImpl, serviceAccount, tokens, calls, hosts, projectId };
}

function createFakeCloudflare({ account = 'a'.repeat(32), zone = 'b'.repeat(32), token = `cf-${crypto.randomBytes(16).toString('hex')}` } = {}) {
  const calls = [];
  async function fetchImpl(url, opts = {}) {
    const u = new URL(url);
    calls.push(u.pathname);
    if ((opts.headers || {}).Authorization !== `Bearer ${token}`) return json(403, { success: false, errors: [{ code: 10000, message: 'Authentication error' }] });
    const p = u.pathname.replace('/client/v4', '');
    if (p === `/accounts/${account}/pages/projects/site-alfa/deployments`) return json(200, { success: true, result: [
      { id: 'd1', environment: 'preview', url: 'https://abc.site-alfa.pages.dev', created_on: '2026-10-02T10:00:00Z', latest_stage: { name: 'deploy', status: 'success' }, deployment_trigger: { metadata: { branch: 'staging', commit_hash: 'c'.repeat(40) } } },
      { id: 'd0', environment: 'production', url: 'https://site-alfa.pages.dev', created_on: '2026-10-01T10:00:00Z', latest_stage: { name: 'deploy', status: 'success' }, deployment_trigger: { metadata: { branch: 'main', commit_hash: 'd'.repeat(40) } } }] });
    if (p === `/accounts/${account}/pages/projects/site-alfa/domains`) return json(200, { success: true, result: [{ name: 'alfa.com.br', status: 'active' }] });
    if (p === `/accounts/${account}/workers/scripts/api-alfa/deployments`) return json(200, { success: true, result: { deployments: [{ id: 'w1', created_on: '2026-10-02T09:00:00Z', source: 'wrangler', strategy: 'percentage', versions: [{ version_id: 'v1', percentage: 100 }] }] } });
    if (p === `/zones/${zone}/dns_records`) return json(200, { success: true, result: [
      { name: 'alfa.com.br', type: 'A', content: '192.0.2.10', proxied: true, ttl: 1 },
      { name: '_verify.alfa.com.br', type: 'TXT', content: 'google-site-verification=segredo-de-verificacao', proxied: false, ttl: 300 }] });
    return json(404, { success: false });
  }
  return { fetchImpl, account, zone, token, calls };
}

/** fetchImpl que encaminha por host para os falsos informados. */
function combineFetch({ github, google, cloudflare }) {
  return async (url, opts) => {
    const host = new URL(url).host;
    if (host === 'api.github.com' && github) return github.fetchImpl(url, opts);
    if (host === 'api.cloudflare.com' && cloudflare) return cloudflare.fetchImpl(url, opts);
    if (google && google.hosts.includes(host)) return google.fetchImpl(url, opts);
    return json(599, { message: `host inesperado no teste: ${host}` });
  };
}

module.exports = { createFakeGoogle, createFakeCloudflare, combineFetch };
