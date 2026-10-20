'use strict';

// Função para sanitizar erros, removendo tokens sensíveis
function sanitizeError(error) {
  if (!error) return 'Erro desconhecido';
  
  // Converte para string se não for
  const errorStr = typeof error === 'string' ? error : JSON.stringify(error);
  
  // Remove tokens sensíveis (API keys, tokens, etc.)
  const sanitized = errorStr
    .replace(/ghp_[a-zA-Z0-9]{36}/g, '[GITHUB_TOKEN]')
    .replace(/sk-[a-zA-Z0-9]{48}/g, '[OPENAI_TOKEN]')
    .replace(/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '[JWT_TOKEN]')
    .replace(/AIza[a-zA-Z0-9_-]{35}/g, '[GOOGLE_API_KEY]')
    .replace(/pk_live_[a-zA-Z0-9_-]{24}/g, '[STRIPE_KEY]')
    .replace(/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '[JWT_TOKEN]')
    .replace(/Bearer [a-zA-Z0-9_-]+/g, '[AUTH_TOKEN]')
    .replace(/secret_[a-zA-Z0-9_-]{24}/g, '[SECRET_KEY]')
    .replace(/ak_[a-zA-Z0-9_-]{32}/g, '[API_KEY]')
    .replace(/ghp_[a-zA-Z0-9]{36}/g, '[GITHUB_TOKEN]')
    .replace(/ghs_[a-zA-Z0-9]{36}/g, '[GITHUB_SECRET]')
    .replace(/pat_[a-zA-Z0-9_-]{24}/g, '[GITHUB_PAT]')
    .replace(/glpat-[a-zA-Z0-9_-]{20}/g, '[GITLAB_TOKEN]')
    .replace(/dapi_[a-zA-Z0-9_-]{32}/g, '[DISCORD_API_KEY]')
    .replace(/[a-zA-Z0-9]{32}/g, '[API_KEY]')
    .replace(/[a-zA-Z0-9]{64}/g, '[LONG_TOKEN]');
  
  return sanitized;
}

module.exports = { sanitizeError };