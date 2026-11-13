#!/usr/bin/env node
'use strict';
// 13/11/2026: gera nexia-ai/fabrica/prontos.json a partir da planilha de licenças conferidas no GitHub
// (C:/NEXIA-TROCA/relatorios/biblioteca-licencas.tsv: repo, categoria, uso, licenca, estrelas, ultimo_push, linguagem, arquivado).
// Só entra MIT/Apache não arquivado. NOASSERTION vai para a_conferir; o resto para fora.
// Uso: node scripts/gerar-prontos.js <caminho do .tsv>
const fs = require('node:fs');
const path = require('node:path');

const DESTINO = path.join(__dirname, '..', 'nexia-ai', 'fabrica', 'prontos.json');
const OK = new Set(['MIT', 'Apache-2.0']);
const LIB = /\(lib\)|template|componentes/;

function gerar(tsv, anterior = {}) {
  const linhas = tsv.trim().split('\n').slice(1).map((l) => l.split('\t')).filter((c) => c[0]);
  const vistos = new Map();
  for (const [repo, categoria, uso, licenca, est, push, ling, arq] of linhas) {
    if (!OK.has(licenca) || arq === 'true') continue;
    vistos.set(repo.toLowerCase(), { repo, url: 'https://github.com/' + repo, categoria, uso, licenca, estrelas: +est || 0, atualizado: push, linguagem: ling, tipo: LIB.test(uso) ? 'peca' : 'sistema', servidor: !LIB.test(uso) });
  }
  const prontos = [...vistos.values()].sort((a, b) => a.categoria.localeCompare(b.categoria) || b.estrelas - a.estrelas);
  const unico = (xs) => [...new Set(xs)];
  return {
    _sobre: anterior._sobre,
    palavras: anterior.palavras,
    prontos,
    a_conferir: unico(linhas.filter((c) => c[3] === 'NOASSERTION').map((c) => c[0])),
    fora: unico(linhas.filter((c) => !OK.has(c[3]) && c[3] !== 'NOASSERTION').map((c) => `${c[0]} (${c[3] === 'NAO-EXISTE' ? 'link não existe' : c[3]})`)),
  };
}

module.exports = { gerar };
if (require.main === module) {
  const anterior = JSON.parse(fs.readFileSync(DESTINO, 'utf8'));
  const r = gerar(fs.readFileSync(process.argv[2], 'utf8'), anterior);
  fs.writeFileSync(DESTINO, JSON.stringify(r, null, 1) + '\n');
  console.log(`${r.prontos.length} aprovados, ${r.a_conferir.length} a conferir, ${r.fora.length} fora`);
}
