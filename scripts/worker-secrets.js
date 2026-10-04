#!/usr/bin/env node
'use strict';
// ADR-FREE-02: o deploy copia para o Worker os segredos do repositório no GitHub (um lugar só para
// o dono cadastrar). O workflow passa cada segredo como variável de ambiente com o nome do
// .env.example; aqui entram só esses nomes, com valor. Grava um JSON para o `wrangler secret bulk`
// com permissão 600 e imprime só a quantidade e os nomes, nunca valores. Sai com 1 se não há nada.
const fs = require('fs');
const path = require('path');

// GITHUB_TOKEN do Actions é temporário; o token do Cloudflare é só do deploy.
const SKIP = new Set(['NODE_ENV', 'PORT', 'GITHUB_TOKEN', 'CLOUDFLARE_API_TOKEN']);
const NAMES = fs.readFileSync(path.join(__dirname, '..', '.env.example'), 'utf8')
  .split('\n').map(l => (/^([A-Z][A-Z0-9_]*)=/.exec(l) || [])[1]).filter(n => n && !SKIP.has(n));

function pickWorkerSecrets(source = process.env) {
  const out = {};
  for (const k of NAMES) if (typeof source[k] === 'string' && source[k]) out[k] = source[k];
  return out;
}

if (require.main === module) {
  const file = process.argv[2];
  if (!file) { console.error('uso: node scripts/worker-secrets.js <arquivo-de-saída>'); process.exit(2); }
  const picked = pickWorkerSecrets();
  fs.writeFileSync(file, JSON.stringify(picked), { mode: 0o600 });
  console.log(`[worker-secrets] ${Object.keys(picked).length} segredos: ${Object.keys(picked).sort().join(', ') || '(nenhum)'}`);
  if (!Object.keys(picked).length) process.exit(1);
}

module.exports = { pickWorkerSecrets, NAMES };
