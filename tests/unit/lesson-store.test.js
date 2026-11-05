'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { LessonStore } = require('../../nexia-ai/cortex/licoes.js');

test('LessonStore adiciona e recupera lições corretamente', async () => {
  const store = new LessonStore();
  const lesson = await store.addLesson({
    assinatura: 'err_test',
    causa: 'causa de teste',
    resolucao: 'resolucao de teste',
    issue: '#123'
  });
  assert.strictEqual(lesson.assinatura, 'err_test');
  
  const similar = store.getSimilarLessons('err_test');
  assert.strictEqual(similar.length, 1);
  assert.strictEqual(similar[0].causa, 'causa de teste');

  const recent = store.getRecentLessons(5);
  assert.strictEqual(recent.length, 1);

  const avoid = await store.incrementAvoidCount('err_test');
  assert.strictEqual(avoid, 2);

  const counts = store.getAvoidCounts();
  assert.strictEqual(counts['err_test'], 2);
});
