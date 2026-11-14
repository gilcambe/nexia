'use strict';

/**
 * Worker de Health Check: a cada 5 minutos faz uma chamada curta (/v1/models ou equivalente)
 * para cada provider usando sua chave, registrando sucesso/falha em livro_cotas.last_failures.
 */

// Providers conhecidos e chaves correspondentes no ambiente
const PROVIDERS = [
  { name: 'openai', envKey: 'OPENAI_API_KEY', url: 'https://api.openai.com/v1/models', authHeader: k => `Bearer ${k}` },
  { name: 'anthropic', envKey: 'ANTHROPIC_API_KEY', url: 'https://api.anthropic.com/v1/models', authHeader: k => ({ 'x-api-key': k, 'anthropic-version': '2023-06-01' }) },
  { name: 'groq', envKey: 'GROQ_API_KEY', url: 'https://api.groq.com/openai/v1/models', authHeader: k => `Bearer ${k}` },
  { name: 'gemini', envKey: 'GEMINI_API_KEY', url: 'https://generativelanguage.googleapis.com/v1beta/models', authHeader: k => `key=${k}` },
  { name: 'deepseek', envKey: 'DEEPSEEK_API_KEY', url: 'https://api.deepseek.com/v1/models', authHeader: k => `Bearer ${k}` }
];

async function checkProvider(provider) {
  const apiKey = process.env[provider.envKey];
  const timestamp = new Date().toISOString();

  if (!apiKey) {
    return {
      success: false,
      timestamp,
      error: `Chave ${provider.envKey} não configurada no ambiente.`
    };
  }

  try {
    let url = provider.url;
    const headers = { 'Content-Type': 'application/json' };
    
    if (provider.name === 'gemini') {
      url = `${provider.url}?key=${apiKey}`;
    } else {
      const auth = provider.authHeader(apiKey);
      if (typeof auth === 'string') {
        headers['Authorization'] = auth;
      } else {
        Object.assign(headers, auth);
      }
    }

    const response = await fetch(url, { method: 'GET', headers });
    if (response.ok) {
      return { success: true, timestamp };
    } else {
      return { success: false, timestamp, error: `HTTP status ${response.status}` };
    }
  } catch (err) {
    return { success: false, timestamp, error: err.message };
  }
}

async function runHealthCheck(db = null) {
  console.log('[HealthCheck] Iniciando verificação de saúde dos providers...');
  const results = {};

  for (const provider of PROVIDERS) {
    const result = await checkProvider(provider);
    results[provider.name] = result;
    console.log(`[HealthCheck] Provider ${provider.name}: ${result.success ? 'SUCESSO' : 'FALHA (' + result.error + ')'}`);

    // Se houver banco de dados configurado (ex: Sequelize ou modelo livro_cotas), atualiza last_failures
    if (db && db.models && db.models.livro_cotas) {
      try {
        await db.models.livro_cotas.update(
          { last_failures: result },
          { where: { provider: provider.name } }
        );
      } catch (dbErr) {
        console.error(`[HealthCheck] Erro ao atualizar last_failures para ${provider.name}:`, dbErr.message);
      }
    }
  }

  return results;
}

module.exports = {
  runHealthCheck,
  PROVIDERS
};
