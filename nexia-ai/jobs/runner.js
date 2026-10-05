'use strict';
// ADR-FREE-02: executa uma tarefa da fila (no GitHub Actions, em Node). Mesmo código e mesmo
// Vault que a API usa; só muda onde roda. Devolve um resumo curto, sem dados do cliente
// (o log do Actions de repositório público é público).

const { validateJob, contextFor, sweepAllTenants } = require('./index');

/**
 * @param {object} rawJob  pedido vindo do workflow (JSON)
 * @param {{ db?, vault?, orchestrator?, sourceFactory? }} [deps]  injeção para testes
 */
async function runJob(rawJob, deps = {}) {
  const job = validateJob(rawJob);
  const db = deps.db || require('../../netlify/functions/firebase-init').db;
  if (!db) throw new Error('Firestore indisponível (FIREBASE_SERVICE_ACCOUNT_BASE64).');
  const { createVault } = require('../vault');
  const vault = deps.vault || createVault({ db });
  // ADR-CLONE-01: duplicar tenant (cópia preparada pela API; aqui só ids, resumo só com contagens)
  if (job.kind === 'tenant.duplicate') {
    const { duplicateTenant } = require('../tenant-copy');
    const r = await duplicateTenant({ db, vault, source: job.tenant, target: job.target, stage: 'resume', actor: job.actor });
    return { kind: job.kind, created: r.created };
  }

  const orchestrator = deps.orchestrator || (() => {
    const { createGateway } = require('../tool-gateway');
    const { createOrchestrator } = require('../orchestrator');
    const gateway = createGateway({ db, vault });
    return createOrchestrator({ vault, gateway, router: require('../model-router').getRouter() });
  })();

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
