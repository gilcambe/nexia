'use strict';

const metricsService = require('../services/metricsService');
const { abrirAlerta } = require('../utils/vigia');

let prioritizePaid = false;

function getPrioritizePaid() {
  return prioritizePaid;
}

function setPrioritizePaid(val) {
  prioritizePaid = !!val;
}

/**
 * Monitora a cota grátis de todos os provedores via metricsService.
 * A cada 5 minutos, soma o uso da cota grátis; se ultrapassar 80% do limite diário,
 * chama a função existente para abrir a issue `cortex-alerta` e define prioritizePaid = true.
 */
async function quotaMonitor({ env = process.env, fetchImpl } = {}) {
  try {
    const usageData = typeof metricsService.getQuotaUsage === 'function' 
      ? await metricsService.getQuotaUsage() 
      : (metricsService.usage || {});

    let totalUsed = 0;
    let totalLimit = 0;

    if (Array.isArray(usageData)) {
      for (const p of usageData) {
        totalUsed += Number(p.used || p.current || 0);
        totalLimit += Number(p.limit || p.max || 100);
      }
    } else if (usageData && typeof usageData === 'object') {
      for (const key of Object.keys(usageData)) {
        const p = usageData[key];
        if (p && typeof p === 'object') {
          totalUsed += Number(p.used || p.current || 0);
          totalLimit += Number(p.limit || p.max || 100);
        }
      }
    }

    if (totalLimit === 0) {
      totalLimit = 100;
    }

    const percentage = (totalUsed / totalLimit) * 100;

    if (percentage > 80) {
      prioritizePaid = true;
      const token = env.NEXIA_JOBS_TOKEN;
      if (token) {
        const alertaObj = {
          url: 'cota-gratis',
          nome: 'Cota Grátis de Provedores',
          codigo: Math.round(percentage)
        };
        try {
          await abrirAlerta(alertaObj, { token, fetchImpl });
        } catch (e) {
          // ignora erro de rede ou GitHub se indisponível em teste
        }
      }
      return { status: 'alerta', percentage, prioritizePaid };
    }

    return { status: 'normal', percentage, prioritizePaid };
  } catch (err) {
    return { status: 'erro', error: err.message };
  }
}

module.exports = { quotaMonitor, getPrioritizePaid, setPrioritizePaid };
