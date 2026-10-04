'use strict';
// ADR-FREE-02: tarefas longas fora do Worker grátis.
// O Worker grátis tem 10 ms de CPU e 50 chamadas externas por pedido; uma execução de agente ou
// um onboarding fazem centenas. Com NEXIA_JOBS=github, a API registra o pedido no Vault como
// sempre e dispara o workflow "NEXIA Jobs" no GitHub Actions (grátis em repositório público),
// que roda o mesmo código em Node (scripts/nexia-job.js). Sem NEXIA_JOBS, nada muda: a tarefa
// roda no próprio processo, como no server.js.
//
// O pedido ao GitHub leva só ids (tenant, execução, projeto, usuário): nada de segredo nem de
// conteúdo do cliente, porque os logs do Actions de repositório público são públicos.

const { createExecutionContext, EXECUTION_ID_RE } = require('../vault/execution');

const KINDS = ['execution.run', 'execution.resume', 'execution.refresh', 'project.onboard', 'sweep'];
const TENANT_RE = /^[a-z0-9][a-z0-9_-]{0,62}$/;
const ID_RE = /^[a-z]{2,4}_[a-f0-9]{32}$/;
const ACTOR_ID_RE = /^[A-Za-z0-9:_.@-]{1,128}$/;
const NAME_RE = /^[A-Za-z0-9_.-]{1,100}$/;
const REPO_RE = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const WORKFLOW = 'nexia-jobs.yml';
const STALE_MS = 10 * 60 * 1000;

class JobError extends Error {
  constructor(code, message) { super(message); this.name = 'JobError'; this.code = code; }
}

/** Confere e normaliza um pedido de tarefa (o mesmo validador roda no Worker e no Actions). */
function validateJob(job) {
  const bad = what => { throw new JobError('INVALID_JOB', `Tarefa inválida: ${what}.`); };
  if (!job || typeof job !== 'object') bad('formato');
  if (!KINDS.includes(job.kind)) bad('kind');
  const out = { kind: job.kind };
  if (job.tenant !== undefined) { if (!TENANT_RE.test(job.tenant)) bad('tenant'); out.tenant = job.tenant; }
  if (job.actor !== undefined) {
    if (!job.actor || !['user', 'agent', 'system'].includes(job.actor.type) || !ACTOR_ID_RE.test(job.actor.id || '')) bad('actor');
    out.actor = { type: job.actor.type, id: job.actor.id };
  }
  if (job.kind !== 'sweep' && (!out.tenant || !out.actor)) bad('tenant/actor');
  if (job.kind === 'sweep' && (out.tenant ? !out.actor : out.actor)) bad('tenant e actor juntos');
  if (job.kind.startsWith('execution.') || job.kind === 'project.onboard') {
    if (!ID_RE.test(job.id || '')) bad('id');
    out.id = job.id;
  }
  if (job.ctx_id !== undefined) { if (!EXECUTION_ID_RE.test(String(job.ctx_id))) bad('ctx_id'); out.ctx_id = job.ctx_id; }
  if (job.kind === 'project.onboard') {
    const r = job.repository || {};
    if (!NAME_RE.test(r.owner || '') || !NAME_RE.test(r.repo || '')) bad('repository');
    if (r.ref !== undefined && !/^[A-Za-z0-9._/-]{1,255}$/.test(r.ref)) bad('repository.ref');
    out.repository = { owner: r.owner, repo: r.repo, ...(r.ref ? { ref: r.ref } : {}) };
    if (job.repository_id !== undefined) { if (!ID_RE.test(job.repository_id)) bad('repository_id'); out.repository_id = job.repository_id; }
  }
  return out;
}

/**
 * Despachante usado pela API. enabled=false → o chamador roda a tarefa no próprio processo.
 * @param {{ env?: Record<string,string>, fetchImpl?: typeof fetch }} [o]
 */
function createJobs({ env = process.env, fetchImpl = (...a) => fetch(...a) } = {}) {
  const enabled = env.NEXIA_JOBS === 'github';
  const repo = env.NEXIA_JOBS_REPO || 'gilcambe/nexia';
  const ref = env.NEXIA_JOBS_REF || 'develop';

  async function dispatch(job) {
    const clean = validateJob(job);
    if (!enabled) throw new JobError('DISABLED', 'Fila de tarefas desligada (NEXIA_JOBS).');
    if (!env.NEXIA_JOBS_TOKEN) throw new JobError('NO_TOKEN', 'NEXIA_JOBS_TOKEN não configurado nos segredos do Worker.');
    if (!REPO_RE.test(repo)) throw new JobError('INVALID_REPO', 'NEXIA_JOBS_REPO inválido.');
    const r = await fetchImpl(`https://api.github.com/repos/${repo}/actions/workflows/${WORKFLOW}/dispatches`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.NEXIA_JOBS_TOKEN}`, Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'nexia-jobs', 'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref, inputs: { job: JSON.stringify(clean) } }),
    });
    if (r.status !== 204) throw new JobError('DISPATCH_FAILED', `GitHub recusou a tarefa (${r.status}).`);
    return { queued: true, kind: clean.kind };
  }

  return { enabled, dispatch };
}

/** Contexto de execução de uma tarefa (o mesmo usuário e, se veio, o mesmo id de execução). */
function contextFor(job) {
  return createExecutionContext({ tenantId: job.tenant, actor: job.actor, ...(job.ctx_id ? { executionId: job.ctx_id } : {}) });
}

/**
 * Retomada de todas as empresas (cron): até 20 execuções paradas, cada uma em nome de quem pediu.
 * Usada pelo processo Node (server.js ou Actions); o Worker só verifica e despacha.
 */
async function sweepAllTenants({ db, orchestrator, max = 20 }) {
  const tenants = (await db.collection('tenants').select().limit(200).get()).docs.map(d => d.id).filter(t => TENANT_RE.test(t));
  const items = [];
  for (const tenantId of tenants) {
    const sys = createExecutionContext({ tenantId, actor: { type: 'system', id: 'cron-sweep' } });
    // Aprovações (waiting_approval) ficam de fora: retomar depois de aprovar é ação de pessoa.
    const done = await orchestrator.sweep(sys, { statuses: ['planned', 'running'], max: max - items.length,
      ctxFor: x => createExecutionContext({ tenantId, actor: x.requested_by, executionId: x.execution_id || undefined }) });
    for (const d of done) items.push({ tenant: tenantId, ...d });
    if (items.length >= max) break;
  }
  return { tenants: tenants.length, items };
}

/**
 * Cron do Worker: uma consulta barata. Havendo execução parada há mais de 10 min, dispara
 * a tarefa "sweep" no Actions; senão, não gasta nada.
 */
async function scheduledSweep({ env = process.env, db, jobs, now = () => Date.now() } = {}) {
  const j = jobs || createJobs({ env });
  if (!j.enabled) return { skipped: 'NEXIA_JOBS desligado' };
  const database = db || require('../../netlify/functions/firebase-init').db;
  if (!database) return { skipped: 'Firestore indisponível' };
  const snap = await database.collection('vault_executions').where('status', 'in', ['planned', 'running']).limit(50).get();
  const cutoff = now() - STALE_MS;
  const stale = snap.docs.map(d => d.data()).filter(x => !x.deleted_at)
    .filter(x => { const t = x.updated_at || x.created_at; const ms = t && typeof t.toMillis === 'function' ? t.toMillis() : Date.parse(t); return ms <= cutoff; });
  if (!stale.length) return { stale: 0 };
  await j.dispatch({ kind: 'sweep' });
  return { stale: stale.length, queued: true };
}

module.exports = { KINDS, JobError, validateJob, createJobs, contextFor, sweepAllTenants, scheduledSweep, WORKFLOW };
