'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createContextManager } = require('../../nexia-ai/model-router/contextManager');
const { countTokens } = require('../../utils/tokenCounter');
const { summarizeHistory } = require('../../utils/summary');

test('TokenCounter conta corretamente palavras/tokens', () => {
  assert.strictEqual(countTokens(''), 0);
  assert.strictEqual(countTokens(null), 0);
  assert.strictEqual(countTokens('olá mundo teste'), 3);
});

test('Summary resume histórico quando excede o limite', () => {
  const messages = [
    { role: 'user', content: 'mensagem muito antiga com várias palavras aqui dentro para testar' },
    { role: 'assistant', content: 'resposta antiga' },
    { role: 'user', content: 'olá' }
  ];
  const summarized = summarizeHistory(messages, 5, countTokens);
  assert.ok(summarized.length <= messages.length);
  assert.ok(summarized.some(m => m.content === 'olá'));
});

test('ContextManager processa histórico respeitando limite', () => {
  const manager = createContextManager({ maxTokens: 10 });
  const messages = [
    { role: 'user', content: 'um dois tres quatro cinco seis sete oito nove dez onze doze treze catorze quinze' },
    { role: 'user', content: 'curta' }
  ];
  const processed = manager.processHistory(messages);
  assert.ok(processed.length > 0);
  assert.strictEqual(manager.countTokensOf('olá teste'), 2);
});
