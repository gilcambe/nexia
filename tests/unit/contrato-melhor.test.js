'use strict';
// Melhoria 21 do Cortex: IA forte sem vez = espera (não fracasso) e a rodada seguinte continua do MELHOR resultado.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { executar, lerContrato } = require('../../nexia-ai/contrato/executor');

const F = '```';
const ARQ = v => `ARQUIVO: src/a.js\n${F}js\nmodule.exports = ${v};\n${F}`;
function cenario(v = 0) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'melhor-'));
  fs.mkdirSync(path.join(raiz, 'tests')); fs.mkdirSync(path.join(raiz, 'src'));
  fs.writeFileSync(path.join(raiz, 'src/a.js'), `module.exports = ${v};\n`);
  fs.writeFileSync(path.join(raiz, 'tests/a.test.js'), '// teste\n');
  return raiz;
}
const c = () => lerContrato('Faça a função\nArquivos: `src/a.js`\nTeste: `node --test tests/a.test.js`');
const ler = raiz => fs.readFileSync(path.join(raiz, 'src/a.js'), 'utf8');
// Nota = o valor exportado (0..10); passa com 10.
const rodarTeste = raiz => async () => {
  const v = Number((/= (\d+);/.exec(ler(raiz)) || [])[1] || 0);
  if (v === 10) return { ok: true, saida: 'ok' };
  const s = `PONTUACAO: ${v}/10\n✖ pontos (1ms)\nℹ pass 0\nℹ fail 1`;
  return { ok: false, saida: s, completo: s };
};
function router(porModelo) {
  const chamadas = [];
  return { chamadas, chat: async (m, p) => {
    chamadas.push({ modelo: m.model, conteudo: p.messages[0].content });
    const r = porModelo[m.model].shift();
    if (r instanceof Error) throw r;
    return { text: r, stop_reason: 'stop' };
  } };
}
const base = { memoria: false, porModelo: 1, extrasMax: 0, esperar429Ms: 0 };

test('IA forte sem cota e só a fraca tentou: é ESPERA (sem_cota), não fracasso, e devolve o melhor', async () => {
  const raiz = cenario();
  const rt = router({ forte: [new Error('429 Too Many Requests: tokens per day')], fraca: [ARQ(7)] });
  const r = await executar({ ...base, contrato: c(), raiz, router: rt, modelos: [{ provider: 'g', model: 'forte' }, { provider: 'k', model: 'fraca' }], rodarTeste: rodarTeste(raiz) });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.sem_cota, true);
  assert.deepStrictEqual(r.fortesSemVez, ['g/forte']);
  assert.match(r.motivo, /forte/);
  assert.match(r.melhor.estado['src/a.js'], /= 7;/);
  assert.match(r.melhor.texto, /7\/10/);
  assert.match(ler(raiz), /= 0;/, 'o projeto volta ao original');
});

test('IA forte fora do ar (503/timeout) também conta como sem vez', async () => {
  const raiz = cenario();
  const rt = router({ forte: [new Error('503 Service Unavailable')], fraca: [ARQ(3)] });
  const r = await executar({ ...base, contrato: c(), raiz, router: rt, modelos: [{ provider: 'g', model: 'forte' }, { provider: 'k', model: 'fraca' }], rodarTeste: rodarTeste(raiz) });
  assert.strictEqual(r.sem_cota, true);
});

test('todas tentaram e erraram: é fracasso de verdade (não espera)', async () => {
  const raiz = cenario();
  const rt = router({ forte: [ARQ(5)], fraca: [ARQ(2)] });
  const r = await executar({ ...base, contrato: c(), raiz, router: rt, modelos: [{ provider: 'g', model: 'forte' }, { provider: 'k', model: 'fraca' }], rodarTeste: rodarTeste(raiz) });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.sem_cota, false);
  assert.match(r.melhor.estado['src/a.js'], /= 5;/, 'guarda o melhor (5), não o último (2)');
});

test('rodada seguinte continua do melhor anterior: a IA recebe o código dele e só precisa terminar', async () => {
  const raiz = cenario();
  const rt = router({ forte: [ARQ(10)] });
  const r = await executar({ ...base, contrato: c(), raiz, router: rt, modelos: [{ provider: 'g', model: 'forte' }], rodarTeste: rodarTeste(raiz), inicio: { 'src/a.js': 'module.exports = 7;\n' } });
  assert.strictEqual(r.ok, true);
  assert.match(rt.chamadas[0].conteudo, /module\.exports = 7;/, 'a IA parte do código da rodada anterior');
  assert.match(rt.chamadas[0].conteudo, /PONTUACAO: 7\/10/, 'e recebe o erro dele');
});

test('melhor anterior pior que o original (ou de outro arquivo) é ignorado', async () => {
  const raiz = cenario(4);
  const rt = router({ forte: [ARQ(10)] });
  const r = await executar({ ...base, contrato: c(), raiz, router: rt, modelos: [{ provider: 'g', model: 'forte' }], rodarTeste: rodarTeste(raiz), inicio: { 'src/a.js': 'module.exports = 2;\n', 'src/outro.js': 'x' } });
  assert.strictEqual(r.ok, true);
  assert.match(rt.chamadas[0].conteudo, /module\.exports = 4;/);
  assert.ok(!fs.existsSync(path.join(raiz, 'src/outro.js')), 'arquivo fora do contrato não é escrito');
});
