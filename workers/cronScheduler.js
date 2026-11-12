'use strict';

const { runHealthCheck } = require('./healthCheck');

/**
 * Agendador de Cron para os workers.
 * Executa a cada 5 minutos a verificação de saúde dos providers.
 */
function startCronScheduler(db = null) {
  console.log('[CronScheduler] Agendador iniciado. Health check configurado para rodar a cada 5 minutos.');

  // Executa imediatamente na inicialização
  runHealthCheck(db).catch(err => {
    console.error('[CronScheduler] Erro na execução inicial do health check:', err);
  });

  // Intervalo de 5 minutos (5 * 60 * 1000 ms)
  const INTERVALO_MS = 5 * 60 * 1000;
  
  const timer = setInterval(async () => {
    console.log(`[CronScheduler] [${new Date().toISOString()}] Executando health check agendado (a cada 5 min)...`);
    try {
      await runHealthCheck(db);
    } catch (err) {
      console.error('[CronScheduler] Erro durante a execução agendada do health check:', err);
    }
  }, INTERVALO_MS);

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
