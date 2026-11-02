'use strict';
// #2826 (parte 2 de #1846): provedor `maquinas` (PCs do dono com Ollama) no roteador.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createMaquinas } = require('../../nexia-ai/maquinas');
const { createMaquinasProvider } = require('../../nexia-ai/model-router/providers/maquinas');
const { createMemoryDriver } = require('../../lib/firebase-lite/d1-backend');

const env = { NEXIA_MAQUINA_TOKEN: 'x'.repeat(30) };

test('PM1. sem PC online falha na hora (o roteador pula), sem criar tarefa', async () => {
  const driver = createMemoryDriver();
  const mq = createMaquinas({ env, driver });
  const p = createMaquinasProvider({ env, maquinas: mq, esperar: async () => { throw new Error('não devia esperar'); } });
  assert.equal(p.available(), true);
  await assert.rejects(p.chat('qwen2.5:1.5b', { messages: [{ role: 'user', content: 'oi' }] }), /nenhum PC online/);
  assert.equal((await driver.list('', 'tarefas_locais', false)).length, 0);
});

test('PM2. com PC online enfileira e devolve o texto quando o PC termina', async () => {
  const driver = createMemoryDriver();
  const mq = createMaquinas({ env, driver });
  await mq.pulso('PC1', { cpu: 'i5', ollamaOk: true, modelos: ['qwen2.5:1.5b'] });
  const p = createMaquinasProvider({
    env, maquinas: mq,
    esperar: async () => { const t = await mq.pegarTarefa('PC1'); if (t) await mq.resultado('PC1', { id: t.id, texto: 'Resumo pronto', tokens: 12 }); },
  });
  const r = await p.chat('qwen2.5:1.5b', { system: 'Resuma.', messages: [{ role: 'user', content: 'texto longo' }] });
  assert.equal(r.text, 'Resumo pronto');
  assert.equal(r.usage.output_tokens, 12);
  assert.equal(r.maquina, 'PC1');
});

test('PM3. PC online que não responde: desiste em 90 s', async () => {
  const driver = createMemoryDriver();
  const mq = createMaquinas({ env, driver });
  await mq.pulso('PC2', { ollamaOk: true });
  let t = 0;
  const p = createMaquinasProvider({ env, maquinas: mq, agora: () => t, esperar: async (ms) => { t += ms; } });
  await assert.rejects(p.chat('m', { messages: [{ role: 'user', content: 'x' }] }), (e) => e.isTimeout === true && /90 s/.test(e.message));
  assert.ok(t >= 90000 && t < 95000);
});

test('PM4. sem token fica indisponível; o roteador registra o provedor', () => {
  assert.equal(createMaquinasProvider({ env: {}, maquinas: createMaquinas({ env: {}, driver: createMemoryDriver() }) }).available(), false);
  const { createRouter } = require('../../nexia-ai/model-router');
  const r = createRouter({ env: {} });
  assert.equal(r.capabilities({ provider: 'maquinas', model: 'qwen2.5:1.5b' }).available, false);
});
