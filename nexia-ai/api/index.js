'use strict';
// /api/nexia/* — API do NEXIA AI (Fase 3): cadastro de clientes, projetos,
// repositórios e ambientes no Vault, onboarding de projeto (leitura externa) e
// snapshot. Mesmo formato de handler das funções (event → { statusCode, headers, body }).
//
// Autorização: token Firebase obrigatório. Master opera em qualquer tenant;
// admin opera só no próprio tenant; demais papéis não acessam o Vault (igual às
// regras do Firestore para vault_*).
const { publicErrorBody } = require('../../lib/safe-error');
const { createVault, createExecutionContext, VaultError, CODES } = require('../vault');
const { onboardProject } = require('../onboarding');
const { createGithubSource, SourceError } = require('../onboarding/sources');

const RESOURCES = { clients: 'Client', projects: 'Project', repos: 'Repository', environments: 'Environment' };
const TENANT_RE = /^[a-z0-9][a-z0-9_-]{0,62}$/;

const STATUS_BY_CODE = {
  [CODES.VALIDATION]: 400, [CODES.CONTEXT]: 400, [CODES.SECRET_DETECTED]: 422, [CODES.NOT_FOUND]: 404,
  [CODES.TENANT_NOT_FOUND]: 404, [CODES.REFERENCE]: 422, [CODES.HAS_DEPENDENTS]: 409, [CODES.UNIQUE]: 409,
  [CODES.VERSION_CONFLICT]: 412, [CODES.IDEMPOTENCY_CONFLICT]: 409, [CODES.DELETED]: 409, [CODES.SCHEMA_VERSION]: 500,
  [CODES.UNAVAILABLE]: 503,
};
const SOURCE_STATUS = { INVALID: 400, NOT_FOUND: 404, FORBIDDEN: 502, UPSTREAM: 502 };

function headersFor(event, extra = {}) {
  const { makeHeaders } = require('../../netlify/functions/middleware');
  return { ...makeHeaders(event), 'Cache-Control': 'no-store', ...extra };
}
const json = (event, statusCode, body, extra) => ({ statusCode, headers: headersFor(event, extra), body: JSON.stringify(body) });
const etag = r => ({ ETag: `"v${r.version}"` });

/** Lê If-Match ("v3", v3 ou 3) como inteiro. */
function ifMatch(event) {
  const h = event.headers || {};
  const raw = h['if-match'] || h['If-Match'];
  if (!raw) return null;
  const m = /^\s*"?v?(\d+)"?\s*$/.exec(String(raw));
  return m ? Number(m[1]) : NaN;
}

/**
 * @param {{ db?, verify?: (event) => Promise<{ok, uid, role, tenantSlug}>, sourceFactory?: (o) => source }} deps
 *   Injeção usada apenas para apontar o handler para outro Firestore/fonte em testes;
 *   em produção tudo vem do firebase-init, do middleware e do GitHub.
 */
function createHandler(deps = {}) {
  let vault = null;
  const getVault = () => {
    if (vault) return vault;
    const db = deps.db || require('../../netlify/functions/firebase-init').db;
    if (!db) throw new VaultError(CODES.UNAVAILABLE, 'Firestore indisponível.');
    vault = createVault({ db });
    return vault;
  };
  const verify = deps.verify || (event => require('../../netlify/functions/middleware').verifyBearerToken(event));
  const sourceFactory = deps.sourceFactory || (o => createGithubSource(o));

  return async function handler(event) {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: headersFor(event), body: '' };
    try {
      const auth = await verify(event);
      if (!auth.ok) return json(event, 401, { error: auth.reason || 'Não autenticado.' });

      const parts = (event.path || '').replace(/^\/api\/nexia\/?/, '').split('/').filter(Boolean);
      const method = event.httpMethod;
      const q = event.queryStringParameters || {};
      const isMaster = auth.role === 'master';

      if (parts[0] === 'me' && parts.length === 1 && method === 'GET') {
        return json(event, 200, { uid: auth.uid, role: auth.role, tenantSlug: auth.tenantSlug || null,
          canUseVault: isMaster || (auth.role === 'admin' && !!auth.tenantSlug) });
      }

      // Tenant: master escolhe (header X-Tenant-Id ou ?tenant=); admin só o próprio.
      const h = event.headers || {};
      const requested = q.tenant || h['x-tenant-id'] || h['X-Tenant-Id'] || auth.tenantSlug;
      if (typeof requested !== 'string' || !TENANT_RE.test(requested)) return json(event, 400, { error: 'Tenant inválido.' });
      if (!isMaster && !(auth.role === 'admin' && auth.tenantSlug === requested)) {
        return json(event, 403, { error: 'Acesso ao Vault restrito a master ou admin do tenant.' });
      }

      const entity = RESOURCES[parts[0]];
      if (!entity || parts.length > 3) return json(event, 404, { error: 'Rota não encontrada.' });
      const v = getVault();
      const repo = v[entity];
      const ctx = createExecutionContext({ tenantId: requested, actor: { type: 'user', id: auth.uid } });
      const execHeader = { 'X-Execution-Id': ctx.executionId };
      let body = {};
      if (event.body) {
        try { body = JSON.parse(event.body); } catch { return json(event, 400, { error: 'JSON inválido.' }); }
      }
      const id = parts[1];
      const sub = parts[2];

      // Coleção
      if (!id) {
        if (method === 'GET') {
          const where = {};
          for (const k of ['client_id', 'project_id', 'status']) if (q[k]) where[k] = q[k];
          const limit = q.limit ? Number(q.limit) : 50;
          const items = await repo.list(ctx, { where, limit });
          return json(event, 200, { items });
        }
        if (method === 'POST') {
          const key = h['idempotency-key'] || h['Idempotency-Key'];
          const { record, replayed } = await repo.create(ctx, body, key ? { idempotencyKey: key } : {});
          return json(event, replayed ? 200 : 201, { record, replayed }, { ...etag(record), ...execHeader });
        }
        return json(event, 405, { error: 'Método não permitido.' });
      }

      // Sub-recursos
      if (sub) {
        if (sub === 'history' && method === 'GET') return json(event, 200, { items: await repo.history(ctx, id) });
        if (sub === 'restore' && method === 'POST') {
          const ver = ifMatch(event);
          if (ver === null) return json(event, 428, { error: 'If-Match obrigatório.' });
          const record = await repo.restore(ctx, id, { expectedVersion: ver });
          return json(event, 200, { record }, { ...etag(record), ...execHeader });
        }
        if (entity === 'Project' && sub === 'snapshot' && method === 'GET') {
          await repo.get(ctx, id);
          const snaps = await v.ProjectSnapshot.list(ctx, { where: { project_id: id }, limit: 200 });
          const latest = snaps.sort((a, b) => b.generated_at.localeCompare(a.generated_at))[0];
          if (!latest) return json(event, 404, { error: 'Projeto sem snapshot. Rode o onboarding.' });
          return json(event, 200, { record: latest });
        }
        if (entity === 'Project' && sub === 'onboard' && method === 'POST') {
          const r = body.repository || {};
          const source = sourceFactory({ owner: r.owner, repo: r.repo, ref: r.ref });
          const result = await onboardProject({ vault: v, ctx, projectId: id, source, repositoryId: body.repository_id });
          return json(event, 201, result, execHeader);
        }
        return json(event, 404, { error: 'Rota não encontrada.' });
      }

      // Item
      if (method === 'GET') {
        const record = await repo.get(ctx, id);
        return json(event, 200, { record }, etag(record));
      }
      if (method === 'PATCH' || method === 'DELETE') {
        const ver = ifMatch(event);
        if (ver === null) return json(event, 428, { error: 'If-Match obrigatório.' });
        const record = method === 'PATCH'
          ? await repo.update(ctx, id, body, { expectedVersion: ver })
          : await repo.softDelete(ctx, id, { expectedVersion: ver });
        return json(event, 200, { record }, { ...etag(record), ...execHeader });
      }
      return json(event, 405, { error: 'Método não permitido.' });
    } catch (e) {
      if (e instanceof VaultError || (e && STATUS_BY_CODE[e.code] && e.name !== 'SourceError')) {
        return json(event, STATUS_BY_CODE[e.code] || 400, { error: e.message, code: e.code, details: e.details || {} });
      }
      if (e instanceof SourceError) return json(event, SOURCE_STATUS[e.code] || 502, { error: e.message, code: `SOURCE_${e.code}` });
      return json(event, 500, publicErrorBody('nexia-api', e));
    }
  };
}

module.exports = { createHandler, handler: createHandler(), RESOURCES, STATUS_BY_CODE };
