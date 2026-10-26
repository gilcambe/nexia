#!/usr/bin/env node
/**
 * Script de carga para a rota /api/cortex (cortex-chat).
 * Uso: node scripts/cortex-carga.js --falso|--real --pessoas <N>
 *
 * Mede métricas: p50, p95, totalTime, errorRate, queueRate, providerBreakdown.
 * Salva JSON carga-relatorio-<timestamp>.json e imprime tabela no console.
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

let axios;
try {
  axios = require('axios');
} catch (_) {
  axios = null;
}

const API_URL = process.env.NEXIA_APP_URL || 'http://localhost:8787';
const CORTEX_PATH = '/api/cortex';

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { modo: null, pessoas: 1 };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--falso') opts.modo = 'falso';
    else if (a === '--real') opts.modo = 'real';
    else if (a === '--pessoas') {
      const v = Number(args[i + 1]);
      if (!Number.isNaN(v) && v > 0) opts.pessoas = v;
      i++;
    }
  }
  return opts;
}

function tempoAleatorio(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function percentile(valores, p) {
  if (valores.length === 0) return 0;
  const v = [...valores].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * v.length) - 1;
  return v[Math.max(0, Math.min(idx, v.length - 1))];
}

async function requisicaoFalso() {
  const inicio = Date.now();
  const atraso = tempoAleatorio(10, 500);
  await new Promise((r) => setTimeout(r, atraso));
  const fim = Date.now();
  return {
    ok: true,
    primeiroPalavra: atraso,
    totalTime: fim - inicio,
    status: 200,
    queueTime: 0,
    provider: 'simulado',
  };
}

async function requisicaoReal(idx) {
  const inicio = Date.now();
  let primeiroPalavra = null;
  let queueTime = 0;
  let provider = 'desconhecido';
  let status = 0;
  let ok = false;
  const body = {
    mensagem: `Olá, sou a pessoa ${idx}. Esta é uma mensagem de teste de carga.`,
    idioma: 'pt-BR',
  };
  try {
    const resp = await axios.post(`${API_URL}${CORTEX_PATH}`, body, {
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    });
    status = resp.status || 0;
    ok = status >= 200 && status < 300;
    const dados = resp.data || {};
    provider = dados.provider || 'desconhecido';
    queueTime = typeof dados.queueTime === 'number' ? dados.queueTime : 0;
    // pega timestamp da primeira palavra se vier na resposta
    if (typeof dados.firstWordMs === 'number') {
      primeiroPalavra = dados.firstWordMs;
    } else {
      primeiroPalavra = Date.now() - inicio;
    }
  } catch (erro) {
    status = erro.response ? erro.response.status : 0;
    ok = false;
    primeiroPalavra = Date.now() - inicio;
  }
  return {
    ok,
    primeiroPalavra,
    totalTime: Date.now() - inicio,
    status,
    queueTime,
    provider,
  };
}

async function main() {
  const opts = parseArgs();
  if (!opts.modo) {
    console.error('Uso: node scripts/cortex-carga.js --falso|--real --pessoas <N>');
    process.exit(1);
  }

  const n = opts.pessoas;
  const resultados = [];
  const erros5xx = [];
  const fila = [];
  const providers = {};
  const temposPrimeira = [];
  const temposTotal = [];

  const limite = Math.min(n, 20); // concorrência controlada
  const executando = new Set();
  let pendentes = n;
  let indice = 0;

  async function lancar() {
    if (indice >= n) return;
    const i = indice++;
    executando.add(i);
    let resultado;
    try {
      resultado = opts.modo === 'falso' ? await requisicaoFalso() : await requisicaoReal(i);
    } catch (erro) {
      resultado = {
        ok: false,
        primeiroPalavra: Date.now(),
        totalTime: 0,
        status: 0,
        queueTime: 0,
        provider: 'erro',
      };
    }
    executando.delete(i);
    resultados.push(resultado);
    pendentes--;

    temposPrimeira.push(resultado.primeiroPalavra || 0);
    temposTotal.push(resultado.totalTime || 0);
    providers[resultado.provider] = (providers[resultado.provider] || 0) + 1;
    if (resultado.queueTime > 0) fila.push(resultado.queueTime);
    if (resultado.status >= 500) erros5xx.push(resultado);

    if (pendentes > 0) lancar();
  }

  // inicia em lotes para respeitar concorrência
  for (let i = 0; i < limite && i < n; i++) lancar();
  while (pendentes > 0) {
    await new Promise((r) => setTimeout(r, 50));
  }

  const p50 = percentile(temposPrimeira, 50);
  const p95 = percentile(temposPrimeira, 95);
  const totalTimeMedio = temposTotal.length ? temposTotal.reduce((a, b) => a + b, 0) / temposTotal.length : 0;
  const errorRate = n > 0 ? (erros5xx.length / n) * 100 : 0;
  const queueRate = n > 0 ? (fila.length / n) * 100 : 0;

  const relatorio = {
    modo: opts.modo,
    pessoas: n,
    concorrencia: limite,
    p50,
    p95,
    totalTime: totalTimeMedio,
    errorRate,
    queueRate,
    providerBreakdown: providers,
    totalErros5xx: erros5xx.length,
    totalNaFila: fila.length,
    geradoEm: new Date().toISOString(),
  };

  const ts = new Date().toISOString().replace(/[:.-]/g, '');
  const nomeArquivo = `carga-relatorio-${ts}.json`;
  try {
    const fs = await import('fs');
    fs.writeFileSync(nomeArquivo, JSON.stringify(relatorio, null, 2));
    console.log(`\nRelatório salvo em: ${nomeArquivo}`);
  } catch (erro) {
    console.error('Não foi possível salvar o relatório:', erro.message);
  }

  // tabela simples no console
  console.log('\n=== Métricas de carga (Cortex) ===');
  console.log(`Modo ............: ${opts.modo}`);
  console.log(`Pessoas .........: ${n}`);
  console.log(`Concorrência ....: ${limite}`);
  console.log(`p50 (ms) ........: ${p50}`);
  console.log(`p95 (ms) ........: ${p95}`);
  console.log(`Tempo médio (ms).: ${Math.round(totalTimeMedio)}`);
  console.log(`Erros 5xx .......: ${errorRate.toFixed(2)}%`);
  console.log(`Na fila .........: ${queueRate.toFixed(2)}%`);
  console.log(`Provedores ......: ${JSON.stringify(providers)}`);
  console.log('==================================\n');
}

main().catch((erro) => {
  console.error('Erro inesperado:', erro.message);
  process.exit(1);
});
