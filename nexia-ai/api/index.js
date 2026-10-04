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
const { resolveProject } = require('../project-resolver');
const { buildContext } = require('../context-engine');
const { createGateway, GatewayError } = require('../tool-gateway');
const { HTTP_STATUS: GATEWAY_STATUS } = require('../tool-gateway/errors');
const { createOrchestrator } = require('../orchestrator');
const { collectMetrics } = require('../observability');
const { createBridgeTokens, ingestEvents, bearerOf, MAX_EVENTS } = require('../bridge-sync');
const { createJobs, sweepAllTenants, JobError } = require('../jobs');

const RESOURCES = { clients: 'Client', projects: 'Project', repos: 'Repository', environments: 'Environment', 'tool-policies': 'ToolPolicy' };
const INVOKE_STATUS = { succeeded: 200, pending_approval: 202, denied: 403, failed: 422, rejected: 409, running: 202, expired: 409 };
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
  let gateway = null;
  const getGateway = () => {
    if (gateway) return gateway;
    const v = getVault();
    gateway = createGateway({ db: deps.db || require('../../netlify/functions/firebase-init').db, vault: v, ...(deps.gateway || {}) });
    return gateway;
  };

  let orchestrator = null;
  const getOrchestrator = () => orchestrator || (orchestrator = createOrchestrator({ vault: getVault(), gateway: getGateway(),
    router: deps.router || require('../model-router').getRouter(), now: deps.now }));
  // TEMPORÁRIO (ADR-F10-03): a execução roda no próprio processo depois da resposta 202.
  // Se o processo reiniciar no meio, a execução fica parada até um POST .../resume.
  const background = deps.background || (fn => setImmediate(() => fn().catch(e => console.error('[nexia-orchestrator]', e && e.code, e && e.message))));

  // ADR-FREE-02: no Worker grátis (NEXIA_JOBS=github) as tarefas longas vão para o GitHub Actions.
  const jobs = deps.jobs || createJobs({ env: deps.env || process.env });
  const queue = async job => {
    try { return await jobs.dispatch(job); }
    catch (e) {
      // A execução fica registrada (planned/running); a retomada agendada tenta de novo.
      console.error('[nexia-jobs]', e && e.code, e && e.message);
      return { queued: false, error: e instanceof JobError ? e.code : 'DISPATCH_FAILED' };
    }
  };

  const bridgeTokens = () => createBridgeTokens(deps.db || require('../../netlify/functions/firebase-init').db);

  async function bridgeEvents(event) {
    if (event.httpMethod !== 'POST') return json(event, 405, { error: 'Método não permitido.' });
    if (!bearerOf(event)) return json(event, 401, { error: 'Token do Bridge ausente.' });
    let tokens;
    try { tokens = bridgeTokens(); } catch (e) { if (e.status) return json(event, e.status, { error: e.message }); throw e; }
    const who = await tokens.authenticate(event);
    if (!who) return json(event, 401, { error: 'Token do Bridge inválido ou revogado.' });
    let b;
    try { b = JSON.parse(event.body || '{}'); } catch { return json(event, 400, { error: 'JSON inválido.' }); }
    if (!Array.isArray(b.events) || b.events.length > MAX_EVENTS) return json(event, 400, { error: `events: lista de até ${MAX_EVENTS} itens.` });
    const r = await ingestEvents({ vault: getVault(), tenantId: who.tenantId, events: b.events });
    return json(event, 200, r);
  }

  async function cronSweep(event) {
    const secret = (deps.env || process.env).NEXIA_CRON_SECRET || '';
    if (secret.length < 32) return json(event, 404, { error: 'Rota não encontrada.' });
    if (event.httpMethod !== 'POST') return json(event, 405, { error: 'Método não permitido.' });
    const h = event.headers || {};
    const given = String(h['x-nexia-cron'] || h['X-Nexia-Cron'] || '');
    const a = Buffer.from(given), b = Buffer.from(secret);
    if (a.length !== b.length || !require('crypto').timingSafeEqual(a, b)) return json(event, 401, { error: 'Não autenticado.' });
    if (jobs.enabled) return json(event, 202, await queue({ kind: 'sweep' }));
    const db = deps.db || require('../../netlify/functions/firebase-init').db;
    return json(event, 200, await sweepAllTenants({ db, orchestrator: getOrchestrator() }));
  }

  return async function handler(event) {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: headersFor(event), body: '' };
    try {
      // ADR-F12-03: retomada agendada (Cron do Worker no Cloudflare). Sem token de pessoa;
      // só com o segredo NEXIA_CRON_SECRET. Sem o segredo configurado, a rota não existe.
      if ((event.path || '').replace(/\/+$/, '') === '/api/nexia/internal/sweep') {
        return await cronSweep(event);
      }
      // ADR-F12-04: log do NEXIA Bridge (token do Bridge, não de pessoa)
      if ((event.path || '').replace(/\/+$/, '') === '/api/nexia/bridge/events') {
        return await bridgeEvents(event);
      }
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

      // Fase 4: Project Resolver e Context Engine
      if (parts[0] === 'resolve' && parts.length === 1) {
        if (method !== 'POST') return json(event, 405, { error: 'Método não permitido.' });
        let b = {};
        try { b = JSON.parse(event.body || '{}'); } catch { return json(event, 400, { error: 'JSON inválido.' }); }
        const rctx = createExecutionContext({ tenantId: requested, actor: { type: 'user', id: auth.uid } });
        const pc = await resolveProject({ vault: getVault(), ctx: rctx, message: typeof b.message === 'string' ? b.message.slice(0, 4000) : '',
          selectedProjectId: b.selected_project_id, repository: b.repository, workspacePath: b.workspace_path,
          conversationProjectId: b.conversation_project_id, recentProjectIds: Array.isArray(b.recent_project_ids) ? b.recent_project_ids : [] });
        return json(event, 200, pc);
      }
      // Fase 6: Tool Gateway e fila de aprovações
      if (['tools', 'approvals', 'tool-calls'].includes(parts[0])) {
        const gctx = createExecutionContext({ tenantId: requested, actor: { type: 'user', id: auth.uid } });
        const gw = getGateway();
        const gHeaders = { 'X-Execution-Id': gctx.executionId };
        if (parts[0] === 'tools' && parts.length === 1 && method === 'GET') return json(event, 200, { items: gw.describe() });
        if (parts[0] === 'tools' && parts[1] === 'invoke' && parts.length === 2 && method === 'POST') {
          let b = {};
          try { b = JSON.parse(event.body || '{}'); } catch { return json(event, 400, { error: 'JSON inválido.' }); }
          const key = h['idempotency-key'] || h['Idempotency-Key'];
          const r = await gw.invoke(gctx, { projectId: b.project_id, environment: b.environment, tool: b.tool, input: b.input, idempotencyKey: key });
          return json(event, INVOKE_STATUS[r.status] || 200, r, { ...etag(r.tool_call), ...gHeaders });
        }
        if (parts[0] === 'approvals' && parts.length === 1 && method === 'GET') {
          return json(event, 200, { items: await gw.pending(gctx, { projectId: q.project_id }) });
        }
        if (parts[0] === 'approvals' && parts.length === 3 && ['approve', 'reject'].includes(parts[2]) && method === 'POST') {
          const ver = ifMatch(event);
          if (ver === null) return json(event, 428, { error: 'If-Match obrigatório.' });
          const r = await gw[parts[2]](gctx, parts[1], { expectedVersion: ver });
          return json(event, INVOKE_STATUS[r.status] || 200, r, { ...etag(r.tool_call), ...gHeaders });
        }
        if (parts[0] === 'tool-calls' && parts.length === 1 && method === 'GET') {
          if (!q.project_id) return json(event, 400, { error: 'project_id é obrigatório.' });
          const limit = q.limit ? Number(q.limit) : 50;
          return json(event, 200, { items: await gw.calls(gctx, { projectId: q.project_id, limit }) });
        }
        return json(event, 404, { error: 'Rota não encontrada.' });
      }
      // ADR-F12-04: tokens do NEXIA Bridge (criar mostra o token uma vez; listar nunca mostra)
      if (parts[0] === 'bridge-tokens') {
        let bt;
        try { bt = bridgeTokens(); } catch (e) { if (e.status) return json(event, e.status, { error: e.message }); throw e; }
        const actor = { type: 'user', id: auth.uid };
        if (parts.length === 1 && method === 'GET') return json(event, 200, { items: await bt.list(requested) });
        if (parts.length === 1 && method === 'POST') {
          let b = {};
          try { b = JSON.parse(event.body || '{}'); } catch { return json(event, 400, { error: 'JSON inválido.' }); }
          try { const { record, token } = await bt.create(requested, { label: b.label, actor }); return json(event, 201, { record, token }); }
          catch (e) { if (e.status) return json(event, e.status, { error: e.message }); throw e; }
        }
        if (parts.length === 2 && method === 'DELETE') {
          const record = await bt.revoke(requested, parts[1]);
          return record ? json(event, 200, { record }) : json(event, 404, { error: 'Token não encontrado.' });
        }
        return json(event, 405, { error: 'Método não permitido.' });
      }

      // Fase 10: Orchestrator (execuções)
      if (parts[0] === 'executions') {
        const ectx = createExecutionContext({ tenantId: requested, actor: { type: 'user', id: auth.uid } });
        const o = getOrchestrator();
        const v = getVault();
        if (parts.length === 1 && method === 'POST') {
          let b = {};
          try { b = JSON.parse(event.body || '{}'); } catch { return json(event, 400, { error: 'JSON inválido.' }); }
          if (typeof b.message !== 'string' || !b.message.trim() || b.message.length > 4000) return json(event, 400, { error: 'message é obrigatório (até 4000 caracteres).' });
          const key = h['idempotency-key'] || h['Idempotency-Key'];
          const r = await o.start(ectx, { message: b.message, projectId: b.project_id, conversationProjectId: b.conversation_project_id,
            recentProjectIds: Array.isArray(b.recent_project_ids) ? b.recent_project_ids.slice(0, 10) : [], repository: b.repository, budget: b.budget, idempotencyKey: key });
          if (!r.execution) return json(event, 200, r);
          if (!r.replayed) {
            if (jobs.enabled) r.job = await queue({ kind: 'execution.run', tenant: requested, actor: ectx.actor, id: r.execution.id, ctx_id: ectx.executionId });
            else background(() => o.run(ectx, r.execution.id));
          }
          return json(event, r.replayed ? 200 : 202, r, { ...etag(r.execution), 'X-Execution-Id': ectx.executionId });
        }
        if (parts.length === 2 && parts[1] === 'sweep' && method === 'POST') {
          // Fase 11: retoma execuções paradas (ver ADR-F11-03). Síncrono; no máximo 20 por chamada.
          if (jobs.enabled) return json(event, 202, { items: [], job: await queue({ kind: 'sweep', tenant: requested, actor: ectx.actor }) });
          return json(event, 200, { items: await o.sweep(ectx) });
        }
        if (parts.length === 1 && method === 'GET') {
          const where = {};
          for (const k of ['project_id', 'status']) if (q[k]) where[k] = q[k];
          return json(event, 200, { items: await v.Execution.list(ectx, { where, limit: q.limit ? Number(q.limit) : 50 }) });
        }
        if (parts.length === 2 && method === 'GET') {
          const record = await v.Execution.get(ectx, parts[1]);
          return json(event, 200, { record }, etag(record));
        }
        if (parts.length === 3 && ['refresh', 'resume'].includes(parts[2]) && method === 'POST') {
          if (jobs.enabled) {
            const current = await v.Execution.get(ectx, parts[1]);
            const job = await queue({ kind: `execution.${parts[2]}`, tenant: requested, actor: ectx.actor, id: parts[1], ctx_id: current.execution_id || undefined });
            return json(event, 202, { record: current, job }, etag(current));
          }
          const record = await o[parts[2]](ectx, parts[1]);
          return json(event, 200, { record }, etag(record));
        }
        return json(event, 404, { error: 'Rota não encontrada.' });
      }
      // Fase 11: observabilidade, auditoria e custos
      if (parts[0] === 'metrics' && parts.length === 1 && method === 'GET') {
        const mctx = createExecutionContext({ tenantId: requested, actor: { type: 'user', id: auth.uid } });
        if (q.since && Number.isNaN(Date.parse(q.since))) return json(event, 400, { error: 'since inválido (use data ISO).' });
        if (q.project_id) await getVault().Project.get(mctx, q.project_id);
        return json(event, 200, await collectMetrics({ vault: getVault(), ctx: mctx, projectId: q.project_id, since: q.since ? new Date(q.since).toISOString() : undefined }));
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
        if (entity === 'Project' && sub === 'context' && method === 'GET') {
          const budget = q.budget ? Number(q.budget) : undefined;
          if (budget !== undefined && !(Number.isInteger(budget) && budget >= 200 && budget <= 8000)) return json(event, 400, { error: 'budget fora da faixa (200–8000).' });
          const c = await buildContext({ vault: v, ctx, projectId: id, message: typeof q.message === 'string' ? q.message.slice(0, 4000) : '', budgetTokens: budget });
          return json(event, 200, c);
        }
        if (entity === 'Project' && sub === 'onboard' && method === 'POST') {
          const r = body.repository || {};
          if (jobs.enabled) {
            await repo.get(ctx, id);
            const job = await queue({ kind: 'project.onboard', tenant: requested, actor: ctx.actor, id, ctx_id: ctx.executionId,
              repository: { owner: r.owner, repo: r.repo, ...(r.ref ? { ref: r.ref } : {}) }, ...(body.repository_id ? { repository_id: body.repository_id } : {}) });
            return json(event, job.queued ? 202 : job.error === 'INVALID_JOB' ? 400 : 503, { queued: !!job.queued, job }, execHeader);
          }
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
      if (e instanceof GatewayError) return json(event, GATEWAY_STATUS[e.code] || 400, { error: e.message, code: e.code, details: e.details && e.details.problems ? { problems: e.details.problems } : {} });
      return json(event, 500, publicErrorBody('nexia-api', e));
    }
  };
}

module.exports = { createHandler, handler: createHandler(), RESOURCES, STATUS_BY_CODE };
