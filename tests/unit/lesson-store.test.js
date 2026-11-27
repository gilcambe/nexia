const { LessonStore } = require('../../nexia-ai/cortex/licoes');
const cofreInstance = require('../../nexia-ai/cortex/cofre');

const test = require('node:test');
const assert = require('node:assert');

test('lesson store integration', async () => {
  const store = new LessonStore();
  await store.ensureInitialized();

  // Adiciona uma lição
  await store.addLesson({
    assinatura: 'test-assinatura',
    causa: 'test-cause',
    resolucao: 'test-solution',
    issue: 'test-issue'
  });

  // Recupera lições similares
  const similar = store.getSimilarLessons('test');
  assert.ok(Array.isArray(similar), 'Similar lessons deve ser um array');

  // Incrementa contagem de evitação
  await store.incrementAvoidCount('test-assinatura');
  const avoidCounts = store.getAvoidCounts();
  assert.strictEqual(avoidCounts['test-assinatura'], 2, 'Contagem de evitações deve ser incrementada corretamente');

  // Recupera lições recentes
  const recent = store.getRecentLessons();
  assert.ok(Array.isArray(recent), 'Recent lessons deve ser um array');
});
