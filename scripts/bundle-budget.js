#!/usr/bin/env node
// Orçamento de tamanho do site (#810). Grátis, sem dependência nova.
// Lê out/index.html depois do `vite build`, soma o JS que o navegador baixa logo
// na abertura (script de entrada + modulepreload) em gzip e falha se passar do limite.
// Uso: node scripts/bundle-budget.js [pastaDoBuild] (padrão: out). Limite: BUNDLE_BUDGET_KB (padrão 140).
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const LIMITE_PADRAO_KB = 140;

// Devolve os caminhos de JS carregados de cara pelo HTML (sem duplicar).
function jsIniciais(html) {
  const achados = new Set();
  const reScript = /<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["']([^"']+\.js)["'][^>]*>/gi;
  const rePreload = /<link\b[^>]*\brel=["']modulepreload["'][^>]*\bhref=["']([^"']+\.js)["'][^>]*>/gi;
  for (const re of [reScript, rePreload]) {
    let m;
    while ((m = re.exec(html))) achados.add(m[1]);
  }
  return [...achados];
}

function tamanhoGzip(buf) {
  return zlib.gzipSync(buf, { level: 9 }).length;
}

// Confere o orçamento. arquivos: [{ nome, bytes, gzip }]. Devolve { ok, totalGzip, limiteBytes }.
function conferir(arquivos, limiteKb) {
  const totalGzip = arquivos.reduce((s, a) => s + a.gzip, 0);
  const limiteBytes = Math.round(limiteKb * 1024);
  return { ok: totalGzip <= limiteBytes, totalGzip, limiteBytes };
}

function medir(pasta) {
  const html = fs.readFileSync(path.join(pasta, 'index.html'), 'utf8');
  return jsIniciais(html).map((src) => {
    const rel = src.replace(/^https?:\/\/[^/]+/, '').replace(/^\/+/, '').split('?')[0];
    const arq = path.join(pasta, rel);
    const buf = fs.readFileSync(arq);
    return { nome: rel, bytes: buf.length, gzip: tamanhoGzip(buf) };
  });
}

function kb(n) { return (n / 1024).toFixed(1) + ' KB'; }

if (require.main === module) {
  const pasta = path.resolve(process.argv[2] || 'out');
  const limiteKb = Number(process.env.BUNDLE_BUDGET_KB) || LIMITE_PADRAO_KB;
  if (!fs.existsSync(path.join(pasta, 'index.html'))) {
    console.error(`Orçamento: ${pasta}/index.html não existe. Rode "npm run build" antes.`);
    process.exit(1);
  }
  const arquivos = medir(pasta);
  for (const a of arquivos) console.log(`  ${a.nome}  ${kb(a.bytes)} (gzip ${kb(a.gzip)})`);
  const r = conferir(arquivos, limiteKb);
  console.log(`JS inicial: ${kb(r.totalGzip)} gzip de ${kb(r.limiteBytes)} permitidos.`);
  if (!r.ok) {
    console.error('Orçamento estourado: o JS inicial ficou grande demais. Carregue a parte nova sob demanda (import()) ou suba BUNDLE_BUDGET_KB com motivo no PR.');
    process.exit(1);
  }
}

module.exports = { jsIniciais, tamanhoGzip, conferir, medir, LIMITE_PADRAO_KB };
