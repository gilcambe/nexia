#!/usr/bin/env node
'use strict';

const fs = require('fs');

/**
 * Verifica se a data da última execução foi há mais de `maxDias` dias.
 * @param {string|Date|null} created_at
 * @param {number} maxDias - Padrão: 3 dias
 * @param {Date} agora
 * @returns {{ ignorar: boolean, motivo: string, dias: number }}
 */
function verificarIdadeRun(created_at, maxDias = 3, agora = new Date()) {
  if (!created_at) {
    return {
      ignorar: false,
      motivo: 'Nenhuma execução anterior encontrada',
      dias: 0
    };
  }

  const dataUltima = new Date(created_at);
  if (isNaN(dataUltima.getTime())) {
    return {
      ignorar: false,
      motivo: 'Data de execução inválida',
      dias: 0
    };
  }

  const msDiferenca = agora.getTime() - dataUltima.getTime();
  const dias = msDiferenca / (1000 * 60 * 60 * 24);

  if (dias > maxDias) {
    return {
      ignorar: true,
      motivo: `última execução há ${dias.toFixed(1)} dias (limite: ${maxDias} dias)`,
      dias
    };
  }

  return {
    ignorar: false,
    motivo: `última execução há ${dias.toFixed(1)} dias (dentro do limite de ${maxDias} dias)`,
    dias
  };
}

/**
 * Consulta a API do GitHub Actions para obter o último run concluído do workflow.
 */
async function checarUltimaExecucaoGH({
  token = process.env.GITHUB_TOKEN,
  repo = process.env.REPO || process.env.GITHUB_REPOSITORY || 'gilcambe/nexia',
  workflow = 'smoke.yml',
  maxDias = 3,
  agora = new Date()
} = {}) {
  if (!token) {
    console.warn('[SMOKE] Aviso: GITHUB_TOKEN não informado. Prosseguindo com a execução.');
    return { ignorar: false, motivo: 'GITHUB_TOKEN não informado', dias: 0 };
  }

  try {
    const url = `https://api.github.com/repos/${repo}/actions/workflows/${workflow}/runs?status=completed&per_page=5`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'nexia-central-smoke'
      }
    });

    if (!res.ok) {
      console.warn(`[SMOKE] Aviso: API do GitHub respondeu ${res.status}. Prosseguindo.`);
      return { ignorar: false, motivo: `GitHub API HTTP ${res.status}`, dias: 0 };
    }

    const data = await res.json();
    const runs = data.workflow_runs || [];

    if (!runs.length) {
      return { ignorar: false, motivo: 'Nenhum run concluído encontrado no GitHub Actions', dias: 0 };
    }

    // Pega a data do run concluído mais recente
    const ultimoRun = runs[0];
    const dataCriacao = ultimoRun.created_at || ultimoRun.updated_at;

    return verificarIdadeRun(dataCriacao, maxDias, agora);
  } catch (err) {
    console.warn('[SMOKE] Erro ao consultar GitHub API:', err.message);
    return { ignorar: false, motivo: `Erro na consulta: ${err.message}`, dias: 0 };
  }
}

async function main() {
  const res = await checarUltimaExecucaoGH();

  if (res.ignorar) {
    console.log(`[SMOKE] PULADO: Runs com mais de 3 dias foram pulados (${res.motivo}).`);
  } else {
    console.log(`[SMOKE] OK: Execução liberada (${res.motivo}).`);
  }

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `pulado=${res.ignorar}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `motivo=${res.motivo}\n`);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[SMOKE] Erro fatal:', err);
    process.exit(1);
  });
}

module.exports = {
  verificarIdadeRun,
  checarUltimaExecucaoGH,
  main
};
