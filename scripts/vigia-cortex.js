#!/usr/bin/env node
'use strict';
// Vigia do Cortex: se a fila parou, abre a issue "cortex-alerta" para o dono (o GitHub manda e-mail).

const REPO = process.env.REPO || 'gilcambe/nexia';
const DONO = process.env.DONO || 'gilcambe';
const PAINEL = 'https://nexia.gcbezerra.workers.dev/meu-cortex';

async function gh(token, method, caminho, body) {
  const r = await fetch('https://api.github.com' + caminho, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + token,
      'User-Agent': 'vigia-cortex',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  const data = text ? JSON.parse(text) : null;
  if (!r.ok) {
    throw new Error('GitHub API ' + method + ' ' + caminho + ' -> ' + r.status + ' ' + text);
  }
  return data;
}

function formatarErro(err) {
  const msg = err && err.message ? String(err.message) : String(err);
  return msg.replace(/(ghp_[A-Za-z0-9]{20,}|gho_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{40,})/g, '***');
}

async function jaExisteAlerta(token) {
  const issues = await gh(token, 'GET', '/repos/' + REPO + '/issues?state=open&per_page=100');
  return (Array.isArray(issues) ? issues : []).some(function (it) {
    return it && typeof it.title === 'string' && it.title.trim().toLowerCase() === 'cortex-alerta';
  });
}

async function abrirAlerta(token, motivo) {
  const body = [
    'A fila do Cortex parece ter parado.',
    '',
    'Motivo: ' + (motivo || 'desconhecido'),
    'Painel: ' + PAINEL,
    'Repo: ' + REPO,
    '',
    '@' + DONO,
  ].join('\n');

  return gh(token, 'POST', '/repos/' + REPO + '/issues', {
    title: 'cortex-alerta',
    body: body,
  });
}

async function main() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) {
    console.error('GITHUB_TOKEN é obrigatório.');
    process.exit(2);
  }

  let motivo = null;
  try {
    if (!await jaExisteAlerta(token)) {
      const issue = await abrirAlerta(token, motivo);
      console.log('Issue aberta: ' + (issue && issue.html_url ? issue.html_url : REPO + '#?'));
    } else {
      console.log('Já existe issue cortex-alerta aberta; nada a fazer.');
    }
  } catch (err) {
    console.error('Falha no Vigia do Cortex: ' + formatarErro(err));
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { gh, jaExisteAlerta, abrirAlerta, main };
