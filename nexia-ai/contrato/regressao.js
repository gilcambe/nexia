'use strict';
// Melhoria 29 (17/11/2026): sem CORTEX_REGRESSAO o Cortex não rodava NENHUM teste além do contrato. Caso #3942: a tela
// do Salário passou no contrato mas quebrou tests/unit/prumo-app.test.js (PA9) e só a homologação pegou.
// Agora: monta sozinho a lista de testes vizinhos dos arquivos mexidos (tests/unit/<chave>*.test.js), onde
// chave = 1ª pasta e nome do arquivo (ex.: prumo/orcamento.js -> "prumo", "orcamento";
// netlify/functions/prumo-lib/salario.js -> "prumo", "salario").
const fs = require('fs');
const path = require('path');

const MAX_TESTES = 40;
const GENERICAS = new Set(['src', 'lib', 'app', 'apps', 'api', 'index', 'main', 'netlify', 'functions', 'scripts', 'public', 'tests', 'test', 'util', 'utils', 'nexia', 'nexia-ai']);

function chaves(arquivo) {
  const partes = String(arquivo).replace(/\\/g, '/').split('/').filter(Boolean);
  const nomes = partes.map((p, i) => (i === partes.length - 1 ? p.replace(/\.[^.]+$/, '') : p).replace(/-lib$/, ''));
  return [...new Set(nomes.map((n) => n.toLowerCase()).filter((n) => n.length >= 4 && !GENERICAS.has(n) && /^[\w-]+$/.test(n)))];
}

function regressaoPadrao(arquivos, raiz, testesDoContrato = []) {
  const dir = path.join(raiz, 'tests', 'unit');
  if (!fs.existsSync(dir)) return '';
  const todos = fs.readdirSync(dir).filter((f) => /\.test\.(?:js|cjs|mjs)$/.test(f)).sort();
  const ks = [...new Set((arquivos || []).flatMap(chaves))];
  const fora = new Set((testesDoContrato || []).map((t) => String(t).replace(/\\/g, '/')));
  const lista = todos.filter((f) => ks.some((k) => f === `${k}.test.js` || f.startsWith(`${k}-`) || f.startsWith(`${k}.`)))
    .map((f) => `tests/unit/${f}`).filter((f) => !fora.has(f)).slice(0, MAX_TESTES);
  return lista.length ? `node --test ${lista.join(' ')}` : '';
}

module.exports = { regressaoPadrao, chaves };
