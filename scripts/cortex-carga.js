#!/usr/bin/env node
'use strict';

const fs = require('fs');

const BASE_URL =
  process.env.CORTEX_URL ||
  process.env.NEXIA_APP_URL ||
  'http://localhost:5173';

function parseArgs(argv) {
  let modo = null;
  let pessoas = 10;
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--falso') modo = 'falso';
    else if (arg === '--real') modo = 'real';
    else if (arg === '--pessoas') {
      pessoas = parseInt(argv[++i], 10) || 10;
    }
  }
  if (!modo) {
    console.error('Uso: node scripts/cortex-carga.js --falso|--real --pessoas <N>');
    process.exit(1);
  }
  return { modo, pessoas };
}

function percentil(valores, p) {
  if (valores.length === 0) return 0;
  const s = [...valores].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * s.length) - 1;
  return s[Math.max(0, Math.min(idx, s.length - 1))];
}

async function requisicaoFalsa() {
  const atraso = 10 + Math.random() * 490; // 10-500 ms
  const inicio = Date.now();
  await new Promise((resolve) => setTimeout(resolve, atraso));
  const total = Date.now() - inicio;
  return {
    ok: true,
    status: 200,
    ttfb: atraso,
    totalTime: total,
    queueTime: 0,
    provider: 'simulado',
    erro5xx: false,
  };
}

async function requisicaoReal(indice) {
  const inicio = Date.now();
  try {
    const res = await fetch(`${BASE_URL}/api/cortex`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mensagem: `Mensagem de carga ${indice}`,
        pessoa: indice,
      }),
    });
    const ttfb = Date.now() - inicio;
    const total = Date.now() - inicio;
    let dados = {};
    try {
      dados = await res.json();
    } catch (_) {
      // ignora se nao for JSON
    }
    return {
      ok: res.ok,
      status: res.status,
      ttfb,
      totalTime: total,
      queueTime: dados.queueTime || 0,
      provider: dados.provider || 'desconhecido',
      erro5xx: res.status >= 500 && res.status < 600,
    };
  } catch (err) {
    const total = Date.now() - inicio;
    return {
      ok: false,
      status: 0,
      ttfb: total,
      totalTime: total,
      queueTime: 0,
      provider: 'erro',
      erro5xx: false,
      excecao: String(err),
    };
  }
}

async function comConcorrencia(tarefas, limite) {
  const resultados = new Array(tarefas.length);
  let indice = 0;
  async function trabalhar() {
    while (indice < tarefas.length) {
      const i = indice++;
      resultados[i] = await tarefas[i]();
    }
  }
  const workers = [];
  for (let w = 0; w < Math.min(limite, tarefas.length); w++) {
    workers.push(trabalhar());
  }
  await Promise.all(workers);
  return resultados;
}

async function main() {
  const { modo, pessoas } = parseArgs(process.argv);
  const concorrencia = 10;

  const tarefas = [];
  for (let i = 0; i < pessoas; i++) {
    if (modo === 'falso') {
      tarefas.push(() => requisicaoFalsa());
    } else {
      tarefas.push(() => requisicaoReal(i));
    }
  }

  const resultados = await comConcorrencia(tarefas, concorrencia);

  const finais = resultados.map((r) =>
    r && r.ok !== undefined ? r : {
      ok: false,
      status: 0,
      ttfb: 0,
      totalTime: 0,
      queueTime: 0,
      provider: 'erro',
      erro5xx: false,
      excecao: r && r.reason ? String(r.reason) : 'desconhecido',
    }
  );

  const ttfbVals = finais.map((r) => r.ttfb);
  const totalVals = finais.map((r) => r.totalTime);
  const erros5xx = finais.filter((r) => r.erro5xx).length;
  const comFila = finais.filter((r) => r.queueTime > 0).length;

  const providerBreakdown = {};
  for (const r of finais) {
    providerBreakdown[r.provider] = (providerBreakdown[r.provider] || 0) + 1;
  }

  const mediaTotal =
    totalVals.length > 0
      ? totalVals.reduce((a, b) => a + b, 0) / totalVals.length
      : 0;

  const relatorio = {
    timestamp: new Date().toISOString(),
    modo,
    pessoas,
    concorrencia: concorrencia,
    p50: percentil(ttfbVals, 50),
    p95: percentil(ttfbVals, 95),
    totalTime: {
      media: mediaTotal,
      max: totalVals.length ? Math.max(...totalVals) : 0,
      min: totalVals.length ? Math.min(...totalVals) : 0,
    },
    errorRate: pessoas ? ((erros5xx / pessoas) * 100).toFixed(2) : 0,
    queueRate: pessoas ? ((comFila / pessoas) * 100).toFixed(2) : 0,
    providerBreakdown,
    resultados: finais,
  };

  const ts = Date.now();
  const nomeArquivo = `carga-relatorio-${ts}.json`;
  fs.writeFileSync(nomeArquivo, JSON.stringify(relatorio, null, 2));

  console.log('\n=== Relatório de carga Cortex ===');
  console.log(`Modo: ${modo} | Pessoas: ${pessoas}`);
  console.log(`p50 (primeira palavra): ${relatorio.p50} ms`);
  console.log(`p95 (primeira palavra): ${relatorio.p95} ms`);
  console.log(`Tempo total médio: ${relatorio.totalTime.media.toFixed(2)} ms`);
  console.log(`Taxa de erros 5xx: ${relatorio.errorRate}%`);
  console.log(`Taxa com fila (queueTime): ${relatorio.queueRate}%`);
  console.log('Provedores:');
  for (const [provedor, qtd] of Object.entries(providerBreakdown)) {
    console.log(`  - ${provedor}: ${qtd}`);
  }
  console.log(`Arquivo salvo: ${nomeArquivo}\n`);
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
