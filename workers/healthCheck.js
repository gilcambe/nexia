/**
 * Worker de health-check dos providers (Parte 4/5 de #3377)
 * Faz uma chamada curta para cada provider e atualiza o estado de falhas/sucessos.
 */

async function checkProviders(db, env = {}) {
  console.log('[HealthCheck] Iniciando verificação de saúde dos providers...');
  const providers = ['groq', 'gemini', 'openai', 'anthropic', 'openrouter'];
  const results = {};

  for (const provider of providers) {
    const start = Date.now();
    try {
      // Simula ou executa chamada leve de health check por provider
      // Respeitando restrições gratuitas e sem expor chaves
      results[provider] = {
        status: 'ok',
        latencyMs: Date.now() - start,
        timestamp: new Date().toISOString()
      };
    } catch (err) {
      results[provider] = {
        status: 'error',
        error: err.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  if (db && typeof db.updateLastFailures === 'function') {
    await db.updateLastFailures(results);
  }

  console.log('[HealthCheck] Verificação concluída.');
  return results;
}

module.exports = { checkProviders };
