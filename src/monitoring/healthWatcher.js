const { setInterval } = require('timers');
const brevoClient = require('../notification/brevoClient');

class QuotaWatcher {
  constructor() {
    this.limits = {
      firestoreReadsPerDay: parseInt(process.env.FIRESTORE_READS_PER_DAY || '50000', 10),
      firestoreWritesPerDay: parseInt(process.env.FIRESTORE_WRITES_PER_DAY || '20000', 10),
      workerRequestsPerDay: parseInt(process.env.WORKER_REQUESTS_PER_DAY || '100000', 10),
      workersAiNeuronsPerDay: parseInt(process.env.WORKERS_AI_NEURONS_PER_DAY || '1000000', 10),
    };
    this.usage = {
      firestoreReads: 0,
      firestoreWrites: 0,
      workerRequests: 0,
      workersAiNeurons: 0,
    };
    this.brakes = {
      firestoreReads: false,
      firestoreWrites: false,
      workerRequests: false,
      workersAiNeurons: false,
    };
    this.brakeThreshold = 0.8; // 80%
    this.isRunning = false;
    this.intervalId = null;
    this.checkInterval = 60000; // 1 minuto
    this.centralEvents = [];
    this.lastResetDate = null;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('QuotaWatcher iniciado - monitorando cotas grátis a cada 60 segundos');
    this.resetDailyUsage();
    this.checkQuotas();
    this.intervalId = setInterval(() => {
      this.checkQuotas();
    }, this.checkInterval);
  }

  stop() {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('QuotaWatcher parado');
  }

  resetDailyUsage() {
    const now = new Date();
    this.lastResetDate = now.getDate();
    this.usage = {
      firestoreReads: 0,
      firestoreWrites: 0,
      workerRequests: 0,
      workersAiNeurons: 0,
    };
    this.brakes = {
      firestoreReads: false,
      firestoreWrites: false,
      workerRequests: false,
      workersAiNeurons: false,
    };
    this.logToCentral('QuotaWatcher: contadores diários resetados');
  }

  recordFirestoreRead(count = 1) {
    if (Number.isInteger(count) && count > 0) {
      this.usage.firestoreReads += count;
    }
  }

  recordFirestoreWrite(count = 1) {
    if (Number.isInteger(count) && count > 0) {
      this.usage.firestoreWrites += count;
    }
  }

  recordWorkerRequest(count = 1) {
    if (Number.isInteger(count) && count > 0) {
      this.usage.workerRequests += count;
    }
  }

  recordWorkersAiNeurons(count = 1) {
    if (Number.isInteger(count) && count > 0) {
      this.usage.workersAiNeurons += count;
    }
  }

  getPercentUsed(resource) {
    const limitKey = `${resource}PerDay`;
    const limit = this.limits[limitKey];
    const used = this.usage[resource];
    if (!limit || limit <= 0) return 0;
    return Math.min(100, Math.round((used / limit) * 100));
  }

  getAllPercents() {
    return {
      firestoreReads: this.getPercentUsed('firestoreReads'),
      firestoreWrites: this.getPercentUsed('firestoreWrites'),
      workerRequests: this.getPercentUsed('workerRequests'),
      workersAiNeurons: this.getPercentUsed('workersAiNeurons'),
    };
  }

  isBraked(resource) {
    return this.brakes[resource] === true;
  }

  checkQuotas() {
    const now = new Date();
    if (this.lastResetDate === null || now.getDate() !== this.lastResetDate) {
      this.resetDailyUsage();
    }

    const percents = this.getAllPercents();
    const alerts = [];

    for (const [resource, percent] of Object.entries(percents)) {
              if (percent >= this.brakeThreshold * 100 && !this.brakes[resource]) {
        this.brakes[resource] = true;
        alerts.push(`${resource} atingiu ${percent}% - freio ativado (opcional desligado)`);
        this.logToCentral(`FREIO: ${resource} em ${percent}% da cota gratuita - serviço opcional desligado`);
        
        // Enviar alerta por e-mail quando o freio for acionado
        try {
          await brevoClient.sendAlertEmail(
            `${resource} atingiu ${percent}% da cota`,
            `O recurso ${resource} atingiu ${percent}% do limite diário gratuito. Serviço opcional desligado para evitar custos.`
          );
        } catch (error) {
          console.error('Falha ao enviar alerta por e-mail:', error.message);
        }
              } else if (percent >= 100) {
        alerts.push(`${resource} estourado: ${percent}%`);
        this.logToCentral(`CRÍTICO: ${resource} estourado ${percent}% da cota gratuita`);
        
        // Enviar alerta crítico por e-mail quando a cota for estourada
        try {
          await brevoClient.sendAlertEmail(
            `${resource} ESTOURADO ${percent}%`,
            `ATENÇÃO: O recurso ${resource} estourou ${percent}% do limite diário gratuito. Ação imediata necessária.`
          );
        } catch (error) {
          console.error('Falha ao enviar alerta crítico por e-mail:', error.message);
        }
      }
    }

    if (alerts.length > 0) {
      console.log('QuotaWatcher alertas:', alerts.join('; '));
    }

    return {
      percents,
      brakes: { ...this.brakes },
      limits: { ...this.limits },
      usage: { ...this.usage },
      alerts,
    };
  }

  logToCentral(message) {
    const event = {
      timestamp: new Date().toISOString(),
      message,
    };
    this.centralEvents.push(event);
    if (this.centralEvents.length > 100) {
      this.centralEvents = this.centralEvents.slice(-100);
    }
    console.log(`[CENTRAL] ${event.timestamp}: ${message}`);
  }

  getCentralEvents() {
    return [...this.centralEvents];
  }

  getStatus() {
    return {
      percents: this.getAllPercents(),
      brakes: { ...this.brakes },
      limits: { ...this.limits },
      usage: { ...this.usage },
      events: this.getCentralEvents(),
    };
  }
}

module.exports = new QuotaWatcher();