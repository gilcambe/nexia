const { LessonStore } = require('../../nexia-ai/cortex/licoes');
const cofreInstance = require('../../nexia-ai/cortex/cofre');

export async function test() {
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
  console.log('Similar lessons:', similar);

  // Incrementa contagem de evitação
  await store.incrementAvoidCount('test-assinatura');
  const avoidCounts = store.getAvoidCounts();
  console.log('Avoid counts:', avoidCounts);

  // Recupera lições recentes
  const recent = store.getRecentLessons();
  console.log('Recent lessons:', recent);
}
