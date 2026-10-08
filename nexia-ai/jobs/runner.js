'use strict';
// ADR-FREE-02: executa uma tarefa da fila (no GitHub Actions, em Node). Mesmo código e mesmo
// Vault que a API usa; só muda onde roda. Devolve um resumo curto, sem dados do cliente
// (o log do Actions de repositório público é público).

const { validateJob, contextFor, sweepAllTenants } = require('./index');

/**
 * @param {object} rawJob  pedido vindo do workflow (JSON)
 * @param {{ db?, vault?, orchestrator?, sourceFactory?, now? }} [deps]  injeção para testes
 */
const isQuota = e => !!e && (e.code === 8 || e.code === 'RESOURCE_EXHAUSTED' || /RESOURCE_EXHAUSTED|Quota exceeded/i.test(String(e.message || '')));

async function runJob(rawJob, deps = {}) {
  const job = validateJob(rawJob);
  const db = deps.db || require('../../netlify/functions/firebase-init').db;
  if (!db) throw new Error('Firestore indisponível (FIREBASE_SERVICE_ACCOUNT_BASE64).');
  // Vault/Cortex podem viver em um segundo projeto grátis (FIREBASE_SERVICE_ACCOUNT_B); sem ele, é o mesmo banco.
  const vdb = deps.vdb || (deps.db ? deps.db : require('../../netlify/functions/firebase-vault').vaultDb());
  try {
    return await runWith(job, deps, db, vdb);
  } catch (e) {
    // Cota grátis do banco B (Vault/Cortex) esgotada: na hora, roda de novo no banco principal (outro projeto grátis).
    if (!isQuota(e)) throw e;
    if (vdb === db || deps.vault) throw bothExhausted(e);
    console.warn('[nexia-job] cota do banco B esgotada; usando o banco principal');
    try { return await runWith(job, deps, db, db); } catch (e2) { throw isQuota(e2) ? bothExhausted(e2) : e2; }
  }
}

// Os dois projetos grátis sem cota: a tarefa não se perde. O workflow guarda o pedido (só ids) numa
// Issue "nexia-job-pendente" e a "Fila do Cortex" despacha de novo quando a cota voltar (grátis, sem Firestore).
function bothExhausted(e) {
  return Object.assign(new Error(`QUOTA_BOTH: cota grátis do Firestore esgotada nos dois bancos (${String(e && e.message || '').slice(0, 120)})`),
    { code: 'QUOTA_BOTH', cause: e });
}

async function runWith(job, deps, db, vdb) {
  const { createVault } = require('../vault');
  const auditSink = require('../vault/audit-file').createFileAuditSink(process.env.NEXIA_AUDIT_FILE);
  const vault = deps.vault || createVault({ db: vdb, ...(vdb !== db ? { tenantDb: db } : {}), ...(auditSink ? { auditSink } : {}) });
  // ADR-CLONE-01: duplicar tenant (cópia preparada pela API; aqui só ids, resumo só com contagens)
  if (job.kind === 'tenant.duplicate') {
    const { duplicateTenant } = require('../tenant-copy');
    const r = await duplicateTenant({ db, vault, source: job.tenant, target: job.target, stage: 'resume', actor: job.actor });
    return { kind: job.kind, created: r.created };
  }

  // deps.orchestrator pode ser uma fábrica ({ vdb, vault }) => orquestrador (testes da troca de banco).
  const orchestrator = typeof deps.orchestrator === 'function' ? deps.orchestrator({ vdb, vault }) : deps.orchestrator || (() => {
    const { createGateway } = require('../tool-gateway');
    const { createOrchestrator } = require('../orchestrator');
    const gateway = createGateway({ db: vdb, vault });
    return createOrchestrator({ vault, gateway, router: require('../model-router').getRouter() });
  })();

  // ADR-AUTO-01: robôs vencidos de todas as empresas (cada um em nome do próprio dono).
  if (job.kind === 'robots.run') {
    const { runDueRobots } = require('../robots');
    const r = await runDueRobots({ db, vault, orchestrator, ...(deps.now ? { now: deps.now } : {}) });
    return { kind: job.kind, due: r.due, claimed: r.claimed, started: r.started };
  }

  if (job.kind === 'sweep') {
    if (!job.tenant) {
      const r = await sweepAllTenants({ db, vdb, orchestrator });
      return { kind: job.kind, tenants: r.tenants, resumed: r.items.length };
    }
    const items = await orchestrator.sweep(contextFor(job));
    return { kind: job.kind, resumed: items.length };
  }

  const ctx = contextFor(job);
  if (job.kind.startsWith('execution.')) {
    const action = job.kind.slice('execution.'.length);
    const r = await orchestrator[action](ctx, job.id);
    return { kind: job.kind, id: job.id, status: r && r.status };
  }

  // project.onboard
  const { onboardProject } = require('../onboarding');
  const sourceFactory = deps.sourceFactory || (o => require('../onboarding/sources').createGithubSource(o));
  const source = sourceFactory(job.repository);
  const r = await onboardProject({ vault, ctx, projectId: job.id, source, repositoryId: job.repository_id });
  return { kind: job.kind, id: job.id, snapshot: !!(r && r.snapshot) };
}

module.exports = { runJob, isQuota, bothExhausted };
