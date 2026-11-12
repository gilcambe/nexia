'use strict';
// Frente A (#3377): o executor de contrato respeita o placar de cota. Antes cada rodada começava "cega" e gastava
// tempo chamando IA que tinha acabado de dar 429.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { executar } = require('../../nexia-ai/contrato/executor');
const { createPlacar } = require('../../nexia-ai/model-router/cota');

const A = { provider: 'groq', model: 'a' }, B = { provider: 'cerebras', model: 'b' };
function repo() {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'kx-placar-'));
  fs.mkdirSync(path.join(raiz, 'lib'));
  return raiz;
}
const contrato = { ok: true, erros: [], arquivos: ['lib/x.js'], teste: 'node --test t', testes: [], pedido: 'x' };
const SOL = 'ARQUIVO: lib/x.js\n```js\nmodule.exports = 1;\n```\n';
const rodarTeste = raiz => async () => ({ ok: fs.existsSync(path.join(raiz, 'lib/x.js')), saida: 'falhou' });

test('PL1. modelo bloqueado no placar vai para o fim da escada (o livre é chamado primeiro)', async () => {
  const placar = createPlacar();
  placar.marcar(A, 'rate', 60 * 60 * 1000);
  const chamados = [];
  const router = { chat: async m => { chamados.push(m.provider); return { text: SOL }; } };
  const raiz = repo();
  const r = await executar({ contrato, raiz, router, modelos: [A, B], rodarTeste: rodarTeste(raiz), placar });
  assert.equal(r.ok, true);
  assert.deepEqual(chamados, ['cerebras']);
});

test('PL2. 429/402 na resposta marca o modelo no placar; sucesso limpa as falhas', async () => {
  const placar = createPlacar();
  const router = { chat: async m => { if (m.provider === 'groq') { const e = new Error('HTTP 429 rate limit'); e.details = { status: 429 }; throw e; } return { text: SOL }; } };
  const raiz = repo();
  const r = await executar({ contrato, raiz, router, modelos: [A, B], rodarTeste: rodarTeste(raiz), placar });
  assert.equal(r.ok, true);
  assert.equal(placar.bloqueado(A), true);
  assert.equal(placar.bloqueado(B), false);
});

test('PL3. sem placar continua funcionando como antes', async () => {
  const raiz = repo();
  const r = await executar({ contrato, raiz, router: { chat: async () => ({ text: SOL }) }, modelos: [A, B], rodarTeste: rodarTeste(raiz) });
  assert.equal(r.ok, true);
  assert.equal(r.modelo, 'groq/a');
});
