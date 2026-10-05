#!/usr/bin/env node
'use strict';
// ADR-AUTO-02: registra no Vault cada deploy do próprio NEXIA (Deployment do projeto gilcambe/nexia,
// ambiente production, provedor cloudflare). Nunca derruba o deploy: se o Vault falhar, só avisa.
// Imprime só o id e o status (o log do Actions é público).
//   node scripts/registrar-deploy.js inicio <sha>   → cria (in_progress) e grava o id em $GITHUB_OUTPUT
//   node scripts/registrar-deploy.js fim <id> <succeeded|failed|rolled_back>
const { loadSecrets } = require('../nexia-ai/jobs/secrets');

const TENANT = process.env.NEXIA_TENANT || 'nexia';
const [OWNER, REPO] = String(process.env.NEXIA_SELF_REPO || 'gilcambe/nexia').split('/');
const URL_PROD = process.env.NEXIA_APP_URL || 'https://nexia.gcbezerra.workers.dev';

async function vaultCtx() {
  loadSecrets(process.env);
  const { db } = require('../netlify/functions/firebase-init');
  if (!db) throw new Error('Firestore indisponível');
  const { createVault, createExecutionContext } = require('../nexia-ai/vault');
  return { vault: createVault({ db }), ctx: createExecutionContext({ tenantId: TENANT, actor: { type: 'system', id: 'deploy-automatico' } }) };
}

async function production(vault, ctx) {
  // O Vault só filtra listagens por client_id, project_id ou status; o resto é filtrado aqui.
  const repo = (await vault.Repository.list(ctx, { limit: 200 })).find(r => r.owner === OWNER && r.repo === REPO);
  if (!repo) throw new Error(`repositório ${OWNER}/${REPO} não está no Vault do tenant ${TENANT}`);
  const env = (await vault.Environment.list(ctx, { where: { project_id: repo.project_id }, limit: 200 })).find(e => e.name === 'production');
  if (env) return { project_id: repo.project_id, env };
  const { record } = await vault.Environment.create(ctx, { project_id: repo.project_id, name: 'production', provider: 'cloudflare', urls: [URL_PROD], branch: 'develop',
    notes: 'Criado pelo deploy automático (ADR-AUTO-02).' });
  return { project_id: repo.project_id, env: record };
}

async function main([cmd, a, b]) {
  const { vault, ctx } = await vaultCtx();
  if (cmd === 'inicio') {
    if (!/^[0-9a-f]{40}$/.test(a || '')) throw new Error('sha inválido');
    const { project_id, env } = await production(vault, ctx);
    const { record } = await vault.Deployment.create(ctx, { project_id, environment_id: env.id, release: `auto-${a.slice(0, 12)}`, commit_sha: a,
      provider: 'cloudflare', status: 'in_progress', started_at: new Date().toISOString(), url: URL_PROD });
    if (process.env.GITHUB_OUTPUT) require('fs').appendFileSync(process.env.GITHUB_OUTPUT, `deployment_id=${record.id}\n`);
    console.log(`Vault: deploy ${record.id} registrado (em andamento)`);
  } else if (cmd === 'fim') {
    if (!/^dpl_[a-f0-9]{32}$/.test(a || '') || !['succeeded', 'failed', 'rolled_back'].includes(b)) throw new Error('uso: fim <id> <succeeded|failed|rolled_back>');
    await vault.Deployment.update(ctx, a, { status: b, finished_at: new Date().toISOString() });
    console.log(`Vault: deploy ${a} → ${b}`);
  } else throw new Error('uso: inicio <sha> | fim <id> <status>');
}

main(process.argv.slice(2)).catch(e => { console.log(`::warning::Vault não registrou o deploy: ${String(e && e.message).slice(0, 200)}`); });
