'use strict';
// CI/CD e deploy (spec §11, §12, §23; Fase 9). O agente não faz deploy por comando: gera o
// pipeline modelo (que entra no repositório por commit + PR) e dispara o workflow.
//   cicd.render_pipeline  LOW            gera .github/workflows/nexia-pipeline.yml (não grava)
//   deploy.staging        HIGH, nível 4  dispara o pipeline com target=staging e registra Deployment
//   deploy.sync_status    LOW            espelha no Vault o resultado da execução no Actions
//   deploy.production     CRITICAL       (Fase 11) sempre com aprovação humana; só o commit que passou em staging
const { renderPipeline, PROVIDERS } = require('../../cicd/pipeline');
const { adapterFor } = require('./github');
const { GatewayError, CODES } = require('../errors');

async function environment({ vault, ctx, project }, name) {
  const list = await vault.Environment.list(ctx, { where: { project_id: project.id }, limit: 20 });
  return list.find(e => e.name === name) || null;
}

const RUN_STATUS = run => !run ? 'pending'
  : run.status !== 'completed' ? 'in_progress'
  : run.conclusion === 'success' ? 'succeeded' : 'failed';

module.exports = [
  {
    name: 'cicd.render_pipeline', risk: 'LOW',
    description: 'Gera o pipeline modelo de GitHub Actions do projeto (CI, staging, smoke e produção protegida) a partir dos ambientes do Vault. Não grava nada: use github.commit_files + github.create_pr.',
    input_schema: { type: 'object', properties: {
      node: { type: 'string' }, output_dir: { type: 'string' }, health_path: { type: 'string' },
      action_pins: { type: 'object', description: 'SHA (40 hex) por ação: actions/checkout, actions/setup-node, google-github-actions/auth' },
      scripts: { type: 'object', properties: { lint: { type: ['string', 'null'] }, test: { type: ['string', 'null'] }, build: { type: ['string', 'null'] } } },
    } },
    summarizeInput: () => 'pipeline modelo',
    async run(deps, i) {
      const { repo } = await adapterFor(deps);
      const staging = await environment(deps, 'staging');
      const production = await environment(deps, 'production');
      const cfg = e => e && { provider: e.provider, url: (e.urls || [])[0] };
      const r = renderPipeline({ defaultBranch: repo.default_branch || 'main', node: i.node, scripts: i.scripts, outputDir: i.output_dir, healthPath: i.health_path, actionPins: i.action_pins,
        staging: cfg(staging), production: staging ? cfg(production) : undefined });
      const warnings = [];
      if (!staging) warnings.push('Projeto sem ambiente staging no Vault: o pipeline só tem CI.');
      if (staging && !production) warnings.push('Projeto sem ambiente production no Vault: o pipeline não tem job de produção.');
      for (const e of [staging, production].filter(Boolean)) if (!(e.urls || []).length) warnings.push(`Ambiente ${e.name} sem URL: o health check usa a variável ${e.name.toUpperCase()}_URL do repositório.`);
      return { path: r.path, content: r.content, warnings };
    },
    summarizeOutput: r => `${r.path} (${r.content.length} bytes${r.warnings.length ? `, ${r.warnings.length} aviso(s)` : ''})`,
  },

  {
    name: 'deploy.staging', risk: 'HIGH', min_autonomy: 4,
    description: 'Dispara o pipeline modelo com target=staging na branch do ambiente staging (ou na padrão) e registra o Deployment no Vault.',
    input_schema: { type: 'object', properties: { ref: { type: 'string' } } },
    summarizeInput: i => `staging${i.ref ? ` de ${i.ref}` : ''}`,
    async run(deps, i) {
      const env = await environment(deps, 'staging');
      if (!env) throw new GatewayError(CODES.INVALID_INPUT, 'O projeto não tem ambiente staging no Vault.');
      if (!PROVIDERS.includes(env.provider)) throw new GatewayError(CODES.INVALID_INPUT, `Staging em "${env.provider}" ainda não é suportado pelo pipeline modelo.`);
      const { gh } = await adapterFor(deps);
      const d = await gh.dispatchPipeline({ ref: i.ref || env.branch || undefined, target: 'staging' });
      const { record } = await deps.vault.Deployment.create(deps.ctx, {
        project_id: deps.project.id, environment_id: env.id, release: `staging-${d.sha.slice(0, 12)}`, commit_sha: d.sha,
        provider: env.provider, status: 'pending', started_at: new Date().toISOString(), ...((env.urls || [])[0] ? { url: env.urls[0] } : {}),
      });
      return { deployment_id: record.id, workflow: d.workflow, ref: d.ref, commit_sha: d.sha, status: record.status };
    },
    summarizeOutput: r => `${r.workflow} em ${r.ref} (${r.commit_sha.slice(0, 7)}…) → ${r.deployment_id}`,
  },

  {
    // Fase 11 (spec §23, ADR-F11-01). CRITICAL: o Policy Engine sempre põe na fila de aprovação,
    // em qualquer autonomia (nível 5 não existe). Além disso, aqui dentro:
    //   - só executa com uma pessoa como ator (a execução aprovada roda no contexto de quem aprovou);
    //   - o commit tem que ser exatamente o que já passou em staging (Deployment succeeded no Vault);
    //   - se a branch andou depois da checagem, o dispatch é recusado (expectedSha).
    // O job de produção do pipeline ainda usa o environment "production" do GitHub (revisores lá).
    name: 'deploy.production', risk: 'CRITICAL',
    description: 'Dispara o pipeline modelo com target=production para o commit que já passou em staging. Sempre exige aprovação humana.',
    input_schema: { type: 'object', properties: { ref: { type: 'string' } } },
    summarizeInput: i => `PRODUÇÃO${i.ref ? ` de ${i.ref}` : ''}`,
    async run(deps, i) {
      if (!deps.ctx.actor || deps.ctx.actor.type !== 'user') throw new GatewayError(CODES.FORBIDDEN, 'Produção só executa depois da aprovação de uma pessoa.');
      const prod = await environment(deps, 'production');
      if (!prod) throw new GatewayError(CODES.INVALID_INPUT, 'O projeto não tem ambiente production no Vault.');
      if (!PROVIDERS.includes(prod.provider)) throw new GatewayError(CODES.INVALID_INPUT, `Produção em "${prod.provider}" ainda não é suportada pelo pipeline modelo.`);
      const staging = await environment(deps, 'staging');
      if (!staging) throw new GatewayError(CODES.STAGING_REQUIRED, 'O projeto não tem staging; produção exige o mesmo commit validado em staging.');
      const { gh, repo } = await adapterFor(deps);
      const ref = i.ref || prod.branch || repo.default_branch;
      const head = (await gh.listBranches({ limit: 100 })).find(b => b.name === ref);
      if (!head) throw new GatewayError(CODES.INVALID_INPUT, `Branch ${ref} não encontrada.`);
      const ok = (await deps.vault.Deployment.list(deps.ctx, { where: { project_id: deps.project.id }, limit: 200 }))
        .some(d => d.environment_id === staging.id && d.status === 'succeeded' && d.commit_sha === head.sha);
      if (!ok) throw new GatewayError(CODES.STAGING_REQUIRED, `O commit ${head.sha.slice(0, 7)} de ${ref} ainda não passou em staging. Publique em staging primeiro.`);
      const d = await gh.dispatchPipeline({ ref, target: 'production', allowProduction: true, expectedSha: head.sha });
      const { record } = await deps.vault.Deployment.create(deps.ctx, {
        project_id: deps.project.id, environment_id: prod.id, release: `production-${d.sha.slice(0, 12)}`, commit_sha: d.sha,
        provider: prod.provider, status: 'pending', started_at: new Date().toISOString(), approved_by: deps.ctx.actor,
        ...((prod.urls || [])[0] ? { url: prod.urls[0] } : {}),
      });
      return { deployment_id: record.id, workflow: d.workflow, ref: d.ref, commit_sha: d.sha, status: record.status, approved_by: deps.ctx.actor.id };
    },
    summarizeOutput: r => `${r.workflow} em ${r.ref} (${r.commit_sha.slice(0, 7)}…) PRODUÇÃO → ${r.deployment_id}`,
  },

  {
    name: 'deploy.sync_status', risk: 'LOW',
    description: 'Consulta a execução do pipeline de um Deployment no GitHub Actions e atualiza o status no Vault.',
    input_schema: { type: 'object', required: ['deployment_id'], properties: { deployment_id: { type: 'string' } } },
    summarizeInput: i => `deployment ${String(i.deployment_id).slice(0, 14)}`,
    async run(deps, i) {
      const dep = await deps.vault.Deployment.get(deps.ctx, i.deployment_id);
      if (dep.project_id !== deps.project.id) throw new GatewayError(CODES.SCOPE, 'Deployment fora do projeto desta chamada.');
      const { gh } = await adapterFor(deps);
      const target = dep.release.startsWith('production-') ? 'production' : 'staging';
      const run = await gh.findPipelineRun({ sha: dep.commit_sha, since: dep.started_at, target });
      const status = RUN_STATUS(run);
      let record = dep;
      if (status !== dep.status && !['succeeded', 'failed', 'rolled_back'].includes(dep.status)) {
        record = await deps.vault.Deployment.update(deps.ctx, dep.id, { status, ...(status === 'succeeded' || status === 'failed' ? { finished_at: run.updated_at || new Date().toISOString() } : {}) },
          { expectedVersion: dep.version });
      }
      return { deployment_id: dep.id, status: record.status, run: run ? { id: run.id, status: run.status, conclusion: run.conclusion, html_url: run.html_url } : null };
    },
    summarizeOutput: r => `${r.deployment_id}: ${r.status}`,
  },
];
