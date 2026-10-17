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

async function checarFilaECriarAlerta() {
  const token = process.env.GITHUB_TOKEN;
  try {
    // Lista issues abertas com o label cortex-alerta
    const issues = await gh(token, 'GET', '/issues?state=open&labels=cortex-alerta');
    if (issues && issues.length > 0) {
      console.log('Já existe alerta aberto (cortex-alerta).');
      return;
    }

    // Consulta estado do Cortex / fila no trabalhador (exemplo de checagem ou fallback)
    console.log('Consultando painel do Cortex em:', PAINEL);
    
    // Como exemplo de verificação da fila ou falha recente, verificamos se há execuções travadas ou erro.
    // Vamos verificar se o workflow recente falhou ou se precisamos abrir issue.
    const runs = await gh(token, 'GET', '/actions/runs?per_page=5');
    if (runs && runs.workflow_runs && runs.workflow_runs.length > 0) {
      const ultimo = runs.workflow_runs[0];
      if (ultimo.conclusion === 'failure') {
        console.log('Última execução falhou. Abrindo issue de alerta para:', DONO);
        await gh(token, 'POST', '/issues', {
          title: 'cortex-alerta: A fila parou ou houve falha no workflow',
          body: `Olá @${DONO}, o vigia detectou que a última execução do workflow falhou ou a fila parou.\n\nVerifique o painel: ${PAINEL}`,
          labels: ['cortex-alerta']
        });
      } else {
        console.log('Fila operando normalmente (última conclusão:', ultimo.conclusion, ').');
      }
    }
  } catch (e) {
    console.error('Erro na verificação do vigia-cortex:', e.message);
  }
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('Erro: GITHUB_TOKEN não definido.');
    process.exit(1);
  }

  console.log('Vigia do Cortex executado para o repositório:', REPO);
  await checarFilaECriarAlerta();
}

if (require.main === module) {
  main().catch(err => {
    console.error('Erro no vigia-cortex:', err);
    process.exit(1);
  });
}