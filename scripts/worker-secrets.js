#!/usr/bin/env node
'use strict';
// ADR-FREE-02: o deploy copia para o Worker os mesmos segredos que o "NEXIA Jobs" usa, a partir dos
// segredos do repositório no GitHub (um lugar só para o dono cadastrar). Grava um JSON para o
// `wrangler secret bulk` com permissão 600 e imprime só a quantidade e os nomes, nunca valores.
const fs = require('fs');
const { ALLOWED } = require('../nexia-ai/jobs/secrets');

const path = require('path');

// Além dos nomes do NEXIA Jobs: os nomes documentados no .env.example (os que o Worker lê) e o
// token que dispara o workflow de tarefas. Nada fora dessa lista vai para o Worker.
const SKIP = new Set(['NODE_ENV', 'PORT', 'GITHUB_TOKEN', 'github_token', 'CLOUDFLARE_API_TOKEN']);
const WORKER_ONLY = new Set(['NEXIA_JOBS_TOKEN', ...fs.readFileSync(path.join(__dirname, '..', '.env.example'), 'utf8')
  .split('\n').map(l => (/^([A-Z][A-Z0-9_]*)=/.exec(l) || [])[1]).filter(Boolean)]);

function pickWorkerSecrets(all) {
  const out = {};
  for (const [k, v] of Object.entries(all || {})) {
    if (typeof v !== 'string' || !v) continue;
    if (SKIP.has(k)) continue; // GITHUB_TOKEN do Actions é temporário; o do Cloudflare é só do deploy
    if (ALLOWED.test(k) || WORKER_ONLY.has(k)) out[k] = v;
  }
  return out;
}

if (require.main === module) {
  const file = process.argv[2];
  if (!file) { console.error('uso: node scripts/worker-secrets.js <arquivo-de-saída>'); process.exit(2); }
  let all = {};
  try { all = JSON.parse(process.env.NEXIA_SECRETS_JSON || '{}'); } catch { console.error('NEXIA_SECRETS_JSON inválido.'); process.exit(2); }
  const picked = pickWorkerSecrets(all);
  fs.writeFileSync(file, JSON.stringify(picked), { mode: 0o600 });
  console.log(`[worker-secrets] ${Object.keys(picked).length} segredos: ${Object.keys(picked).sort().join(', ') || '(nenhum)'}`);
}

module.exports = { pickWorkerSecrets };
