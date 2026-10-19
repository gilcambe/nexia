'use strict';
/**
 * Fila de jobs com prioridade e orçamento por tipo
 * Classes: produção (1) > cliente (2) > melhoria (3)
 * Teto diário de minutos/execuções do Actions para evitar esgotar minutos grátis.
 */

const DAILY_BUDGET_LIMITS = {
  producao: 120, // limite de minutos / créditos diários
  cliente: 60,
  melhoria: 30,
};

const usageStore = {
  date: new Date().toISOString().slice(0, 10),
  producao: 0,
  cliente: 0,
  melhoria: 0,
};

function checkAndUpdateBudget(classType, cost = 1) {
  const today = new Date().toISOString().slice(0, 10);
  if (usageStore.date !== today) {
    usageStore.date = today;
    usageStore.producao = 0;
    usageStore.cliente = 0;
    usageStore.melhoria = 0;
  }

  const limit = DAILY_BUDGET_LIMITS[classType] || 30;
  const current = usageStore[classType] || 0;

  if (current + cost > limit) {
    return { allowed: false, current, limit, remaining: limit - current };
  }

  usageStore[classType] = current + cost;
  return { allowed: true, current: usageStore[classType], limit, remaining: limit - usageStore[classType] };
}

const queue = [];

function enqueueJob(job) {
  // job: { id, type: 'producao'|'cliente'|'melhoria', cost: number, payload: object }
  const priorities = { producao: 1, cliente: 2, melhoria: 3 };
  job.priority = priorities[job.type] || 3;
  job.cost = job.cost || 1;
  queue.push(job);
  // Ordena por prioridade (menor número = maior prioridade)
  queue.sort((a, b) => a.priority - b.priority);
  return { queued: true, position: queue.length, priority: job.type };
}

function processNextJob() {
  if (queue.length === 0) return { processed: false, reason: 'queue_empty' };

  // Acha o primeiro job que respeita o orçamento diário
  for (let i = 0; i < queue.length; i++) {
    const job = queue[i];
    const budgetCheck = checkAndUpdateBudget(job.type, job.cost);
    if (budgetCheck.allowed) {
      queue.splice(i, 1);
      return { processed: true, job, budget: budgetCheck };
    }
  }

  return { processed: false, reason: 'budget_exceeded_for_all' };
}

function getQueueStatus() {
  const today = new Date().toISOString().slice(0, 10);
  if (usageStore.date !== today) {
    usageStore.date = today;
    usageStore.producao = 0;
    usageStore.cliente = 0;
    usageStore.melhoria = 0;
  }
  return {
    queueLength: queue.length,
    jobs: queue.map(j => ({ id: j.id, type: j.type, priority: j.priority, cost: j.cost })),
    usage: { ...usageStore },
    limits: { ...DAILY_BUDGET_LIMITS },
  };
}

module.exports = {
  enqueueJob,
  processNextJob,
  getQueueStatus,
  checkAndUpdateBudget,
};
