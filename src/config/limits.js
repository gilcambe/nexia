'use strict';
/**
 * src/config/limits.js
 * Configurações de limites e tetos de cotas e custos.
 */
module.exports = {
  tetosConfigurados: (env = process.env) => {
    return Boolean(env.NEXIA_TETOS_ATIVOS || env.STRIPE_CUSTOMER_ID || env.MP_ACCESS_TOKEN || env.ALLOW_PAID_PROVIDERS);
  },
  limitesCotistas: {
    anthropic: { maxRequests: 1000, maxTokens: 100000 },
    openai: { maxRequests: 1000, maxTokens: 100000 },
    gemini: { maxRequests: 2000, maxTokens: 200000 },
    cohere: { maxRequests: 1000, maxTokens: 100000 },
  }
};
