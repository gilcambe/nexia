// Compara o resultado da suíte original do READDY com as falhas conhecidas.
// Sai com erro se algum teste fora da lista falhar (regressão) ou se a suíte não rodou inteira.
'use strict';
const fs = require('fs');
const path = require('path');

const reportFile = process.argv[2] || path.join(__dirname, '..', '..', 'test-results', 'readdy-report.json');
const known = require('./readdy-known-failures.json').known;
const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));

const results = [];
(function walk(suites) {
  for (const s of suites || []) {
    for (const spec of s.specs || []) for (const t of spec.tests) results.push({ title: spec.title, status: t.status });
    walk(s.suites);
  }
})(report.suites);

const bad = results.filter(r => r.status !== 'expected' && !(r.title in known));
const fixed = results.filter(r => r.status === 'expected' && r.title in known);
console.log(`READDY original: ${results.length} testes, ${results.filter(r => r.status === 'expected').length} passaram, ` +
  `${results.filter(r => r.status === 'unexpected').length} falharam, ${results.filter(r => r.status === 'skipped').length} pulados, ` +
  `${Object.keys(known).length} conhecidos.`);
for (const r of fixed) console.log(`  agora passa (pode sair da lista): ${r.title}`);
if (results.length !== 89) { console.error(`ERRO: esperava 89 testes, rodaram ${results.length}.`); process.exit(1); }
if (bad.length) {
  for (const r of bad) console.error(`  REGRESSÃO [${r.status}]: ${r.title}`);
  process.exit(1);
}
console.log('Sem regressões em relação ao develop.');
