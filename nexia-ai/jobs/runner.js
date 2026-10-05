'use strict';
// ADR-FREE-02: executa uma tarefa da fila (no GitHub Actions, em Node). Mesmo código e mesmo
// Vault que a API usa; só muda onde roda. Devolve um resumo curto, sem dados do cliente
// (o log do Actions de repositório público é público).

const { validateJob, contextFor, sweepAllTenants } = require('./index');

/**
 * @param {object} rawJob  pedido vindo do workflow (JSON)
 * @param {{ db?, vault?, orchestrator?, sourceFactory?, now? }} [deps]  injeção para testes
 */
async function runJob(rawJob, deps = {}) {
  const job = validateJob(rawJob);
  const db = deps.db || require('../../netlify/functions/firebase-init').db;
  if (!db) throw new Error('Firestore indisponível (FIREBASE_SERVICE_ACCOUNT_BASE64).');
  const { createVault } = require('../vault');
  const vault = deps.vault || createVault({ db });
  const orchestrator = deps.orchestrator || (() => {
    const { createGateway } = require('../tool-gateway');
    const { createOrchestrator } = require('../orchestrator');
    const gateway = createGateway({ db, vault });
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
      const r = await sweepAllTenants({ db, orchestrator });
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

module.exports = { runJob };
