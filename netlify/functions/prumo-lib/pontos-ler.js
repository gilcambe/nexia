'use strict';
/**
 * Kernex Prumo - leitor de print de pontos.
 * Lê o arquivo (imagem/PDF simulado como texto no teste) e extrai:
 * programas (linhas soltas), saldo (linha "Saldo: ...") e vencimento (linha "Vencimento: AAAA-MM-DD").
 */
const fs = require('node:fs');

const DATA = /^\d{4}-\d{2}-\d{2}$/;

const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const numero = (v) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v.replace(/\./g, '').replace(',', '.')) : NaN);
const dinheiro = (n) => Math.round(n * 100) / 100;

function parseConteudo(conteudo) {
  const programas = [];
  let saldo = 0;
  let vencimento = null;
  for (const linha of String(conteudo).split(/\r?\n/)) {
    const l = linha.trim();
    if (!l) continue;
    const mSaldo = l.match(/^saldo:\s*(.*)/i);
    if (mSaldo) { const n = dinheiro(numero(mSaldo[1])); if (Number.isFinite(n)) saldo = n; continue; }
    const mVenc = l.match(/^vencimento:\s*(.*)/i);
    if (mVenc) { const v = texto(mVenc[1], 10); if (DATA.test(v)) vencimento = v; continue; }
    programas.push(l);
  }
  return { programas, saldo, vencimento };
}

async function lerPontos(caminho) {
  const conteudo = fs.readFileSync(caminho, 'utf8');
  return parseConteudo(conteudo);
}

module.exports = { lerPontos, parseConteudo };
