'use strict';
// Melhoria 25 do Cortex (17/11/2026): #3867/#3868 vieram da pista do PC (Antigravity) com os acentos quebrados
// ("Você" virou "Voc├¬", "—" virou "ÔÇö") e o teste de aceitação não percebeu. O executor recusa mudança que aumenta
// os restos de codificação quebrada; o ajudante do PC lê a saída do agy em UTF-8.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { executar, lerContrato } = require('../../nexia-ai/contrato/executor');

const F = '```';
function cenario() {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'acentos-'));
  fs.mkdirSync(path.join(raiz, 'tests')); fs.mkdirSync(path.join(raiz, 'src'));
  fs.writeFileSync(path.join(raiz, 'src/a.js'), "const msg = 'Você está — ótimo';\nmodule.exports = 0;\n");
  fs.writeFileSync(path.join(raiz, 'tests/a.test.js'), '// teste\n');
  return raiz;
}
const c = () => lerContrato('Faça a função\nArquivos: `src/a.js`\nTeste: `node --test tests/a.test.js`');
const ler = (raiz) => fs.readFileSync(path.join(raiz, 'src/a.js'), 'utf8');
const rodarTeste = (raiz) => async () => (/= 10;/.test(ler(raiz)) ? { ok: true, saida: 'ok' } : { ok: false, saida: '✖ x (1ms)\nℹ fail 1', completo: '✖ x (1ms)\nℹ fail 1' });
const router = (respostas) => ({ chamadas: 0, async chat() { this.chamadas++; return { text: respostas.shift() || '', stop_reason: 'stop' }; } });
const base = { memoria: false, porModelo: 2, extrasMax: 0, revisor: false, esperar429Ms: 0, log: () => {} };

test('arquivo inteiro com acento quebrado é recusado; a versão certa (pedida de novo) passa', async () => {
  const raiz = cenario();
  const quebrado = `ARQUIVO: src/a.js\n${F}js\nconst msg = 'Voc├¬ est├í ÔÇö ├│timo';\nmodule.exports = 10;\n${F}`;
  const certo = `ARQUIVO: src/a.js\n${F}js\nconst msg = 'Você está — ótimo';\nmodule.exports = 10;\n${F}`;
  const r = await executar({ ...base, contrato: c(), raiz, router: router([quebrado, certo]), modelos: [{ provider: 'maquinas', model: 'agy' }], rodarTeste: rodarTeste(raiz) });
  assert.strictEqual(r.ok, true);
  assert.match(ler(raiz), /Você está — ótimo/);
  assert.doesNotMatch(ler(raiz), /├|ÔÇ/);
});

test('bloco SEARCH/REPLACE que quebra acento também é recusado (e o arquivo fica como estava)', async () => {
  const raiz = cenario();
  const quebrado = `src/a.js\n${F}js\n<<<<<<< SEARCH\nconst msg = 'Você está — ótimo';\nmodule.exports = 0;\n=======\nconst msg = 'Voc├¬ est├í';\nmodule.exports = 10;\n>>>>>>> REPLACE\n${F}`;
  const r = await executar({ ...base, porModelo: 1, contrato: c(), raiz, router: router([quebrado]), modelos: [{ provider: 'maquinas', model: 'agy' }], rodarTeste: rodarTeste(raiz) });
  assert.strictEqual(r.ok, false);
  assert.match(ler(raiz), /Você está — ótimo/);
});

test('arquivo que JÁ tinha resto quebrado não trava a mudança (só recusa se aumentar)', async () => {
  const raiz = cenario();
  fs.writeFileSync(path.join(raiz, 'src/a.js'), "const velho = 'Ã©';\nmodule.exports = 0;\n");
  const ok = `ARQUIVO: src/a.js\n${F}js\nconst velho = 'Ã©';\nmodule.exports = 10;\n${F}`;
  const r = await executar({ ...base, porModelo: 1, contrato: c(), raiz, router: router([ok]), modelos: [{ provider: 'k', model: 'x' }], rodarTeste: rodarTeste(raiz) });
  assert.strictEqual(r.ok, true);
});

test('ajudante do PC (agy-trabalhador.ps1) lê a saída do agy em UTF-8', () => {
  const ps = fs.readFileSync(path.join(__dirname, '../../tools/agente-maquina/agy-trabalhador.ps1'), 'utf8');
  const iEnc = ps.search(/\[Console\]::OutputEncoding\s*=\s*New-Object Text\.UTF8Encoding/);
  const iAgy = ps.indexOf('& $agy');
  assert.ok(iEnc > 0 && iEnc < iAgy, 'definir [Console]::OutputEncoding UTF-8 ANTES de chamar o agy');
});
