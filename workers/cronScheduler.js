'use strict';

const { runHealthCheck } = require('./healthCheck');
const { formatHealthReport } = require('../src/utils/healthReporter');

/**
 * Agendador de Cron para os workers.
 * Executa a cada 5 minutos a verificação de saúde dos providers.
 */
function startCronScheduler(db = null) {
  console.log('[CronScheduler] Agendador iniciado. Health check configurado para rodar a cada 5 minutos.');

  // Executa imediatamente na inicialização
  tick('inicial');

  // Intervalo de 5 minutos (5 * 60 * 1000 ms)
  const INTERVALO_MS = 5 * 60 * 1000;
  
  const tick = async (motivo) => {
    console.log(`[CronScheduler] [${new Date().toISOString()}] Executando health check (${motivo}, a cada 5 min)...`);
    try {
      const results = await runHealthCheck(db);
      console.log('[CronScheduler] Resultado:\n' + formatHealthReport(results));
    } catch (err) {
      console.error('[CronScheduler] Erro durante a execução do health check:', err.message);
    }
  };

  const timer = setInterval(() => { tick('agendado'); }, INTERVALO_MS);

  // Permite fechar o timer se necessário
  return {
    stop: () => clearInterval(timer)
  };
}

// Se executado diretamente como script
if (require.main === module) {
  startCronScheduler();
}

module.exports = {
  startCronScheduler
};
