'use strict';
// Groq aposenta nomes de modelo (13/11/2026: llama-3.3-70b-versatile deu 404 e calou o Marketing e o Divulga).
const test = require('node:test');
const assert = require('node:assert');
const g = require('../../lib/groq-modelo');

test('GM1. escolhe o primeiro da preferência que está vivo na conta', () => {
  assert.equal(g.escolher(['openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'whisper-large-v3']), 'openai/gpt-oss-120b');
  assert.equal(g.escolher(['llama-3.3-70b-versatile', 'openai/gpt-oss-120b']), 'llama-3.3-70b-versatile');
});

test('GM2. modelo novo fora da lista serve; voz/guarda nunca; lista vazia = reserva', () => {
  assert.equal(g.escolher(['whisper-large-v3', 'meta-llama/llama-guard-4-12b', 'qwen/qwen9-99b']), 'qwen/qwen9-99b');
  assert.equal(g.escolher([]), g.RESERVA);
});

test('GM3. consulta a conta 1 vez por hora; sem rede devolve a reserva sem lançar', async () => {
  g.limparCache(); let n = 0;
  const f = async () => { n++; return { ok: true, json: async () => ({ data: [{ id: 'openai/gpt-oss-20b' }, { id: 'llama-3.1-8b-instant', active: false }] }) }; };
  assert.equal(await g.modeloGroq('k', { fetchImpl: f, agora: 1000 }), 'openai/gpt-oss-20b');
  await g.modeloGroq('k', { fetchImpl: f, agora: 2000 }); assert.equal(n, 1, 'usa o guardado');
  g.limparCache();
  assert.equal(await g.modeloGroq('k', { fetchImpl: async () => { throw new Error('sem rede'); } }), g.RESERVA);
});

test('GM4. modelo que pensa antes ganha espaço; os outros não mudam', () => {
  assert.deepEqual(g.extrasGroq('openai/gpt-oss-120b', 300), { reasoning_effort: 'low', max_tokens: 700 });
  assert.deepEqual(g.extrasGroq('llama-3.3-70b-versatile', 300), {});
});

test('GM5. comGroq: 1 chamada quando o modelo vive; com 404 consulta a lista e tenta 1 vez com o vivo', async () => {
  g.limparCache(); const usados = [];
  const ok = await g.comGroq('k', async (m) => { usados.push(m); return { ok: true, status: 200 }; });
  assert.equal(ok.status, 200); assert.deepEqual(usados, [g.RESERVA]);
  g.limparCache(); usados.length = 0;
  const lista = async () => ({ ok: true, json: async () => ({ data: [{ id: 'openai/gpt-oss-20b' }] }) });
  const r = await g.comGroq('k', async (m) => { usados.push(m); return { ok: m === 'openai/gpt-oss-20b', status: m === 'openai/gpt-oss-20b' ? 200 : 404 }; }, { fetchImpl: lista });
  assert.equal(r.status, 200); assert.deepEqual(usados, [g.RESERVA, 'openai/gpt-oss-20b']);
});
