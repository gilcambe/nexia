#!/usr/bin/env node
'use strict';

/**
 * Script de carga para a rota /api/cortex (cortex-chat).
 * Uso: node scripts/cortex-carga.js --falso|--real --pessoas <N>
 *
 * Mede métricas: p50, p95, totalTime, errorRate, queueRate, providerBreakdown.
 * Salva JSON carga-relatorio-<timestamp>.json e imprime tabela no console.
 * Não usa dependências pagas nem pacotes externos (apenas fetch e APIs nativas do Node.js).
 */

const fs = require('fs');

const API_URL = process.env.NEXIA_APP_URL || 'http://localhost:8787';
const CORTEX_PATH = '/api/cortex';

function parseArgs(argv = process.argv.slice(2)) {
  const opts = { modo: null, pessoas: 50 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--falso') opts.modo = 'falso';
    else if (a === '--real') opts.modo = 'real';
    else if (a === '--pessoas') {
      const v = Number(argv[i + 1]);
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
  if (!valores || valores.length === 0) return 0;
  const v = [...valores].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * v.length) - 1;
  return v[Math.max(0, Math.min(idx, v.length - 1))];
}

async function requisicaoFalso() {
  const inicio = Date.now();
  // Simula resposta entre 10ms e 400ms (p95 bem abaixo da meta de 3s)
  const atraso = tempoAleatorio(10, 400);
  await new Promise((r) => setTimeout(r, atraso));
  const fim = Date.now();
  return {
    ok: true,
    primeiraPalavra: atraso,
    totalTime: fim - inicio,
    status: 200,
    queueTime: 0,
    provider: 'simulado',
  };
}

async function requisicaoReal(idx, baseUrl = API_URL) {
  const inicio = Date.now();
  let primeiraPalavra = null;
  let queueTime = 0;
  let provider = 'desconhecido';
  let status = 0;
  let ok = false;
  const body = {
    mensagem: `Olá, sou a pessoa ${idx}. Esta é uma mensagem de teste de carga.`,
    idioma: 'pt-BR',
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    const resp = await fetch(`${baseUrl}${CORTEX_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    status = resp.status;
    ok = resp.ok;
    let dados = {};
    try {
      dados = await resp.json();
    } catch (_) {
      dados = {};
    }

    provider = dados.provider || 'desconhecido';
    queueTime = typeof dados.queueTime === 'number' ? dados.queueTime : 0;
    if (typeof dados.firstWordMs === 'number') {
      primeiraPalavra = dados.firstWordMs;
    } else {
      primeiraPalavra = Date.now() - inicio;
    }
  } catch (erro) {
    status = 0;
    ok = false;
    primeiraPalavra = Date.now() - inicio;
  }

  return {
    ok,
    primeiraPalavra,
    totalTime: Date.now() - inicio,
    status,
    queueTime,
    provider,
  };
}

async function executarCarga(opts, customRequester = null) {
  const n = opts.pessoas;
  const resultados = [];
  const erros = [];
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
      if (customRequester) {
        resultado = await customRequester(i, opts.modo);
      } else if (opts.modo === 'falso') {
        resultado = await requisicaoFalso();
      } else {
        resultado = await requisicaoReal(i);
      }
    } catch (erro) {
      resultado = {
        ok: false,
        primeiraPalavra: Date.now(),
        totalTime: 0,
        status: 0,
        queueTime: 0,
        provider: 'erro',
      };
    }
    executando.delete(i);
    resultados.push(resultado);
    pendentes--;

    temposPrimeira.push(resultado.primeiraPalavra || 0);
    temposTotal.push(resultado.totalTime || 0);
    providers[resultado.provider] = (providers[resultado.provider] || 0) + 1;
    if (resultado.queueTime > 0) fila.push(resultado.queueTime);
    if (!resultado.ok || resultado.status === 0 || resultado.status >= 400) {
      erros.push(resultado);
    }
    if (resultado.status >= 500) {
      erros5xx.push(resultado);
    }

    if (pendentes > 0) lancar();
  }

  for (let i = 0; i < limite && i < n; i++) lancar();
  while (pendentes > 0) {
    await new Promise((r) => setTimeout(r, 20));
  }

  const p50 = percentile(temposPrimeira, 50);
  const p95 = percentile(temposPrimeira, 95);
  const totalTimeMedio = temposTotal.length ? temposTotal.reduce((a, b) => a + b, 0) / temposTotal.length : 0;
  const errorRate = n > 0 ? (erros.length / n) * 100 : 0;
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
    totalErros: erros.length,
    totalErros5xx: erros5xx.length,
    totalNaFila: fila.length,
    geradoEm: new Date().toISOString(),
  };

  return relatorio;
}

function salvarRelatorio(relatorio) {
  const ts = new Date().toISOString().replace(/[:.-]/g, '');
  const nomeArquivo = `carga-relatorio-${ts}.json`;
  try {
    fs.writeFileSync(nomeArquivo, JSON.stringify(relatorio, null, 2));
    console.log(`\nRelatório salvo em: ${nomeArquivo}`);
  } catch (erro) {
    console.error('Não foi possível salvar o relatório:', erro.message);
  }
  return nomeArquivo;
}

function imprimirTabela(relatorio) {
  console.log('\n=== Métricas de carga (Cortex) ===');
  console.log(`Modo ............: ${relatorio.modo}`);
  console.log(`Pessoas .........: ${relatorio.pessoas}`);
  console.log(`Concorrência ....: ${relatorio.concorrencia}`);
  console.log(`p50 (ms) ........: ${relatorio.p50}`);
  console.log(`p95 (ms) ........: ${relatorio.p95}`);
  console.log(`Tempo médio (ms).: ${Math.round(relatorio.totalTime)}`);
  console.log(`Taxa de Erro ....: ${relatorio.errorRate.toFixed(2)}%`);
  console.log(`Erros 5xx .......: ${relatorio.totalErros5xx}`);
  console.log(`Na fila .........: ${relatorio.queueRate.toFixed(2)}%`);
  console.log(`Provedores ......: ${JSON.stringify(relatorio.providerBreakdown)}`);
  console.log('==================================\n');
}

async function main() {
  const opts = parseArgs();
  if (!opts.modo) {
    console.error('Uso: node scripts/cortex-carga.js --falso|--real --pessoas <N>');
    process.exit(1);
  }

  const relatorio = await executarCarga(opts);
  salvarRelatorio(relatorio);
  imprimirTabela(relatorio);
}

if (require.main === module) {
  main().catch((erro) => {
    console.error('Erro inesperado:', erro.message);
    process.exit(1);
  });
}

module.exports = {
  parseArgs,
  tempoAleatorio,
  percentile,
  requisicaoFalso,
  requisicaoReal,
  executarCarga,
  salvarRelatorio,
  imprimirTabela,
};
