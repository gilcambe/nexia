'use strict';
// Autenticação no GitHub (spec §9 e §15 "Preferir tokens de curta duração").
// Escrita só com GitHub App: o servidor assina um JWT (RS256, 9 min) com a chave da App
// e troca por um token de instalação de 1 h, restrito ao repositório da chamada e às
// permissões da operação. Leitura aceita também o GITHUB_TOKEN legado (ou nenhum, em
// repositório público).
//
// Variáveis: GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY (PEM; "\n" literal é aceito) e,
// opcional, GITHUB_APP_INSTALLATION_ID. Nenhum valor é registrado em log nem em erro.
const crypto = require('crypto');
const { GatewayError, CODES } = require('../tool-gateway/errors');

const b64url = b => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

function appJwt({ appId, privateKey, now = () => Date.now() }) {
  const iat = Math.floor(now() / 1000) - 60; // tolera relógio adiantado no GitHub
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({ iat, exp: iat + 9 * 60, iss: String(appId) }));
  const sig = crypto.sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), privateKey);
  return `${header}.${payload}.${b64url(sig)}`;
}

function appConfig(env) {
  const appId = env.GITHUB_APP_ID && String(env.GITHUB_APP_ID).trim();
  const raw = env.GITHUB_APP_PRIVATE_KEY;
  if (!appId || !raw) return null;
  let privateKey;
  try { privateKey = crypto.createPrivateKey(String(raw).replace(/\\n/g, '\n')); }
  catch { throw new GatewayError(CODES.GITHUB_AUTH, 'GITHUB_APP_PRIVATE_KEY inválida.'); }
  const installationId = env.GITHUB_APP_INSTALLATION_ID ? String(env.GITHUB_APP_INSTALLATION_ID).trim() : null;
  if (!/^\d{1,12}$/.test(appId) || (installationId && !/^\d{1,15}$/.test(installationId))) {
    throw new GatewayError(CODES.GITHUB_AUTH, 'GITHUB_APP_ID/GITHUB_APP_INSTALLATION_ID inválidos.');
  }
  return { appId, privateKey, installationId };
}

/**
 * @param {{ env, fetchImpl, apiBase, now?: () => number }} o
 * @returns {{ mode: 'app'|'token'|'none', headersFor(repo, { write, permissions }): Promise<object> }}
 */
function createAuth({ env, fetchImpl, apiBase, now = () => Date.now() }) {
  const app = appConfig(env);
  const legacy = env.GITHUB_TOKEN || null;
  const installations = new Map(); // owner/repo → installation id
  const tokens = new Map();        // installation|repo|perms → { token, expires }

  async function post(path, jwtOrToken, body) {
    let r;
    try {
      r = await fetchImpl(`${apiBase}${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'nexia-ai-github-adapter', 'X-GitHub-Api-Version': '2022-11-28',
          Authorization: `Bearer ${jwtOrToken}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(20000),
      });
    } catch { throw new GatewayError(CODES.UPSTREAM, 'GitHub indisponível.'); }
    if (r.status === 404) throw new GatewayError(CODES.GITHUB_AUTH, 'A GitHub App não está instalada neste repositório.');
    if (!r.ok) throw new GatewayError(CODES.GITHUB_AUTH, `GitHub recusou a autenticação da App (${r.status}).`);
    return r.json();
  }

  async function installationFor(repo) {
    if (app.installationId) return app.installationId;
    const key = `${repo.owner}/${repo.repo}`.toLowerCase();
    if (!installations.has(key)) {
      const d = await post(`/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/installation`, appJwt({ ...app, now }));
      installations.set(key, String(d.id));
    }
    return installations.get(key);
  }

  async function installationToken(repo, permissions) {
    const inst = await installationFor(repo);
    const perms = Object.keys(permissions).sort().map(k => `${k}:${permissions[k]}`).join(',');
    const key = `${inst}|${repo.repo.toLowerCase()}|${perms}`;
    const hit = tokens.get(key);
    if (hit && hit.expires - 5 * 60 * 1000 > now()) return hit.token;
    const d = await post(`/app/installations/${inst}/access_tokens`, appJwt({ ...app, now }), { repositories: [repo.repo], permissions });
    tokens.set(key, { token: d.token, expires: Date.parse(d.expires_at) || now() + 50 * 60 * 1000 });
    return d.token;
  }

  return {
    mode: app ? 'app' : legacy ? 'token' : 'none',
    /** Cabeçalho Authorization para a operação. Escrita sem App → GITHUB_APP_REQUIRED. */
    async headersFor(repo, { write = false, permissions = { metadata: 'read', contents: 'read' } } = {}) {
      if (app) return { Authorization: `Bearer ${await installationToken(repo, permissions)}` };
      if (write) throw new GatewayError(CODES.GITHUB_APP_REQUIRED, 'Escrever no GitHub exige a GitHub App do NEXIA configurada (GITHUB_APP_ID e GITHUB_APP_PRIVATE_KEY).');
      return legacy ? { Authorization: `Bearer ${legacy}` } : {};
    },
  };
}

module.exports = { createAuth, appJwt, appConfig };
