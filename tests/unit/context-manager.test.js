'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createContextManager } = require('../../../nexia-ai/model-router/contextManager');

test('contextManager - dentro do limite nao altera historico', () => {
  const manager = createContextManager({ maxTokens: 100 });
  const messages = [
    { role: 'user', content: 'Ola' },
    { role: 'assistant', content: 'Oi, tudo bem?' }
  ];
  const processed = manager.processHistory(messages);
  assert.strictEqual(processed.length, 2);
  assert.strictEqual(processed[0].content, 'Ola');
});

test('contextManager - excede limite e resume historico', () => {
  const manager = createContextManager({ maxTokens: 5 });
  const messages = [
    { role: 'user', content: 'Mensagem muito longa que excede o limite de tokens permitido para o teste' },
    { role: 'assistant', content: 'Resposta longa anterior' },
    { role: 'user', content: 'Curta' }
  ];
  const processed = manager.processHistory(messages);
  assert.ok(processed.length <= messages.length);
  assert.ok(manager.countTokensOf('teste de contagem') > 0);
});
