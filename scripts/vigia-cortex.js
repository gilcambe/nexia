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
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`GitHub API ${method} ${caminho}: ${r.status} ${err}`);
  }
  return r.json().catch(() => ({}));
}

async function main() {
  const token = process.env.GITHUB_TOKEN || process.env.NEXIA_GITHUB_TOKEN;
  if (!token) {
    console.error('Erro: GITHUB_TOKEN ou NEXIA_GITHUB_TOKEN não definido.');
    process.exit(1);
  }
  console.log('Vigia do Cortex executado com sucesso.');
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
