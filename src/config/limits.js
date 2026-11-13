'use strict';

/**
 * Configurações de limites e tetos para provedores e cotas.
 */
const LIMITS = {
  defaultDailyRequests: 1000,
  defaultDailyTokens: 1000000,
  maxPromptSizeSmall: 2000,
  maxPromptSizeMedium: 10000,
};

function getLimits(env = process.env) {
  return {
    dailyRequests: Number(env.NEXIA_DAILY_REQUESTS || LIMITS.defaultDailyRequests),
    dailyTokens: Number(env.NEXIA_DAILY_TOKENS || LIMITS.defaultDailyTokens),
    paidAllowed: env.NEXIA_PAID_ALLOWED === 'true' || Boolean(env.NEXIA_PAID_TETOS_CONFIGURADOS),
  };
}

module.exports = {
  LIMITS,
  getLimits,
};
