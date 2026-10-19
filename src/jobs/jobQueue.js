/**
 * Fila de jobs com prioridade e orçamento por tipo.
 * Classes:
 * - 'producao' (prioridade alta)
 * - 'cliente' (prioridade média)
 * - 'melhoria' (prioridade baixa)
 * 
 * Teto diário de execução / orçamento para evitar esgotar minutos do Actions ou recursos.
 */

class JobQueue {
  constructor(options = {}) {
    this.classes = {
      producao: { priority: 1, dailyLimit: options.producaoLimit || 50, usedToday: 0 },
      cliente: { priority: 2, dailyLimit: options.clienteLimit || 30, usedToday: 0 },
      melhoria: { priority: 3, dailyLimit: options.melhoriaLimit || 20, usedToday: 0 }
    };
    this.queue = [];
    this.lastResetDate = new Date().toDateString();
  }

  _checkReset() {
    const today = new Date().toDateString();
    if (today !== this.lastResetDate) {
      for (const cls of Object.keys(this.classes)) {
        this.classes[cls].usedToday = 0;
      }
      this.lastResetDate = today;
    }
  }

  addJob(job) {
    this._checkReset();
    const jobClass = job.class && this.classes[job.class] ? job.class : 'melhoria';
    const queuedJob = {
      ...job,
      class: jobClass,
      priority: this.classes[jobClass].priority,
      addedAt: Date.now()
    };
    this.queue.push(queuedJob);
    this.queue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return a.addedAt - b.addedAt;
    });
    return queuedJob;
  }

  nextJob() {
    this._checkReset();
    for (let i = 0; i < this.queue.length; i++) {
      const job = this.queue[i];
      const clsConfig = this.classes[job.class];
      if (clsConfig.usedToday < clsConfig.dailyLimit) {
        this.queue.splice(i, 1);
        clsConfig.usedToday++;
        return job;
      }
    }
    return null;
  }

  getStatus() {
    this._checkReset();
    const status = {};
    for (const [cls, cfg] of Object.entries(this.classes)) {
      status[cls] = {
        priority: cfg.priority,
        dailyLimit: cfg.dailyLimit,
        usedToday: cfg.usedToday,
        remaining: Math.max(0, cfg.dailyLimit - cfg.usedToday)
      };
    }
    return {
      classes: status,
      pendingJobs: this.queue.length
    };
  }
}

module.exports = { JobQueue };
