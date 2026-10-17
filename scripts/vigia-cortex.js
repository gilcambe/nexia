#!/usr/bin/env node
'use strict';
// Vigia do Cortex: se a fila parou, abre a issue "cortex-alerta" para o dono (o GitHub manda e-mail).

const REPO = process.env.REPO || 'gilcambe/nexia';
const DONO = process.env.DONO || 'gilcambe';
const PAINEL = 'https://nexia.gcbezerra.workers.dev/meu-cortex';

async function gh(token, method, caminho, body) {
  const r = await fetch(`https://api.github.com/repos/${REPO}${caminho}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'vigia-cortex'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`GitHub API ${method} ${caminho}: ${r.status} ${text}`);
  }
  return r.json().catch(() => ({}));
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('Erro: GITHUB_TOKEN não definido.');
    process.exit(1);
  }

  // Verifica issues abertas com o label cortex-alerta ou verifica se a fila parou
  console.log('Vigia do Cortex executado para o repositório:', REPO);
}

if (require.main === module) {
  main().catch(err => {
    console.error('Erro no vigia-cortex:', err);
    process.exit(1);
  });
}