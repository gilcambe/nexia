'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { handlePostResponse } = require('../../src/chat/responseHandler.ts');
const { getFacts, clearInMemoryFacts } = require('../../src/services/memoryService.ts');

test('Integration Test: confirma chamada assíncrona (waitUntil) e persistência de fatos', async () => {
  clearInMemoryFacts();

  let waitUntilCalled = false;
  let capturedPromise = null;

  const mockWaitUntil = (promise) => {
    waitUntilCalled = true;
    capturedPromise = promise;
  };

  const mockRunner = async (config, systemPrompt, userPrompt) => {
    assert.equal(config.provider, 'groq');
    assert.equal(config.model, 'llama-3.1-8b-instant');
    return JSON.stringify([
      'Usuário é Gildivan Bezerra',
      'Minha senha é 12345', // Dado sensível
      'Localização: São Paulo',
      'Preferência: usa dark mode',
    ]);
  };

  const result = handlePostResponse({
    responseText: 'Seu perfil foi atualizado com sucesso!',
    userMessage: 'Meu nome é Gildivan Bezerra, moro em São Paulo e prefiro usar dark mode.',
    tenantId: 'tenant_integ',
    userId: 'user_integ_1',
    conversationId: 'conv_integ_1',
    waitUntil: mockWaitUntil,
    extractorOptions: {
      chatRunner: mockRunner,
    },
  });

  // 1. Confirma que a execução assíncrona foi disparada imediatamente
  assert.equal(result.asyncTriggered, true);
  assert.equal(waitUntilCalled, true);
  assert.ok(capturedPromise instanceof Promise);

  // 2. Aguarda a resolução do processo assíncrono em segundo plano
  const savedRecords = await capturedPromise;

  // 3. Confirma a persistência e valida as restrições da issue
  assert.ok(savedRecords.length <= 3);
  assert.equal(savedRecords.length, 3);

  // Nenhum campo proibido/sensível (senha) está nos registros salvos
  for (const rec of savedRecords) {
    assert.ok(!rec.fact.toLowerCase().includes('senha'));
    assert.ok(rec.salvo_em);
    assert.ok(rec.usado_em);
    assert.equal(rec.tenantId, 'tenant_integ');
    assert.equal(rec.userId, 'user_integ_1');
  }

  // Confirma busca via memoryService
  const storedFacts = await getFacts('user_integ_1', 'tenant_integ', 'conv_integ_1');
  assert.equal(storedFacts.length, 3);
  assert.equal(storedFacts[0].fact, 'Usuário é Gildivan Bezerra');
});
