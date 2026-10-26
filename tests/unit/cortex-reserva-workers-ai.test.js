'use strict';
// #1815: quando todos os provedores falham, o chat usa o Workers AI (binding grátis) como última reserva.
const test = require('node:test');
const assert = require('node:assert');
const chat = require('../../netlify/functions/cortex-chat.js');

test('reserva usa o modelo grande do Workers AI e devolve o texto', async () => {
  const chamadas = [];
  const ai = { run: async (m, o) => { chamadas.push([m, o.messages[0].role, o.messages.at(-1).content]); return { response: 'Canberra' }; } };
  const r = await chat.reservaWorkersAI('sistema', [{ role: 'user', content: 'Capital da Austrália?' }], ai);
  assert.strictEqual(r.text, 'Canberra');
  assert.deepStrictEqual(chamadas, [['@cf/meta/llama-3.3-70b-instruct-fp8-fast', 'system', 'Capital da Austrália?']]);
});

test('se o modelo grande falha, tenta o pequeno', async () => {
  const ai = { run: async (m) => { if (m.includes('70b')) throw new Error('limite'); return { response: 'ok pequeno' }; } };
  const r = await chat.reservaWorkersAI('s', [{ role: 'user', content: 'oi' }], ai);
  assert.strictEqual(r.text, 'ok pequeno');
  assert.match(r.modelo, /llama-3\.1-8b/);
});

test('sem binding ou sem resposta devolve null (mensagem de erro continua)', async () => {
  assert.strictEqual(await chat.reservaWorkersAI('s', [], null), null);
  assert.strictEqual(await chat.reservaWorkersAI('s', [], { run: async () => ({ response: '' }) }), null);
});

test('resposta em JSON (objeto) vira texto JSON, não "[object Object]"', async () => {
  const r = await chat.reservaWorkersAI('s', [{ role: 'user', content: 'json' }], { run: async () => ({ response: { nome: 'Ana', idade: 31 } }) });
  assert.deepStrictEqual(JSON.parse(r.text), { nome: 'Ana', idade: 31 });
});
