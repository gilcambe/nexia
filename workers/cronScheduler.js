/**
 * Agendador de Cron para tarefas em background (Parte 4/5 de #3377)
 */

const { checkProviders } = require('./healthCheck');

class CronScheduler {
  constructor(db = null) {
    this.db = db;
    this.intervalId = null;
  }

  start() {
    console.log('[CronScheduler] Agendador iniciado. Health-check a cada 5 minutos.');
    
    // Executa a cada 5 minutos (300000 ms)
    this.intervalId = setInterval(async () => {
      try {
        console.log('[CronScheduler] Executando cron de 5 min: checkProviders');
        await checkProviders(this.db);
      } catch (err) {
        console.error('[CronScheduler] Erro no cron de health check:', err.message);
      }
    }, 5 * 60 * 1000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[CronScheduler] Agendador parado.');
    }
  }
}

module.exports = { CronScheduler };
