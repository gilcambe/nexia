'use strict';
/**
 * src/jobs/jobQueue.js
 * Fila de jobs com prioridade e orçamento por tipo (produção > cliente > melhoria).
 * Evita esgotar os minutos do GitHub Actions / Cortex.
 */

const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(process.cwd(), 'data', 'job_queue_state.json');

// Classes de prioridade e limites diários de orçamento (em minutos ou contagem)
const CLASSES = {
  producao: { priority: 1, dailyBudgetMinutes: 120 },
  cliente:  { priority: 2, dailyBudgetMinutes: 90 },
  melhoria: { priority: 3, dailyBudgetMinutes: 30 }
};

function ensureDataDir() {
  const dir = path.dirname(STATE_FILE);
  if (!fs.existsSync(dir)) {
    try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
  }
}

function loadState() {
  try {
    ensureDataDir();
    if (fs.existsSync(STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      const today = new Date().toISOString().slice(0, 10);
      if (data.date === today) {
        return data;
      }
    }
  } catch (e) {}
  return { date: new Date().toISOString().slice(0, 10), usage: { producao: 0, cliente: 0, melhoria: 0 }, queue: [] };
}

function saveState(state) {
  try {
    ensureDataDir();
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (e) {}
}

/**
 * Enfileira um job respeitando classes: 'producao', 'cliente', 'melhoria'.
 */
function enqueueJob(job) {
  const jobClass = CLASSES[job.type] ? job.type : 'melhoria';
  const state = loadState();

  const newItem = {
    id: 'job_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    type: jobClass,
    priority: CLASSES[jobClass].priority,
    payload: job.payload || {},
    estimatedMinutes: job.estimatedMinutes || 10,
    createdAt: new Date().toISOString(),
    status: 'pending'
  };

  state.queue.push(newItem);
  // Ordena por prioridade (menor número = maior prioridade: 1 producao, 2 cliente, 3 melhoria) e depois data de criação
  state.queue.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return new Date(a.createdAt) - new Date(b.createdAt);
  });

  saveState(state);
  return newItem;
}

/**
 * Retorna o próximo job autorizado a rodar dentro do orçamento diário.
 */
function getNextJob() {
  const state = loadState();
  const index = state.queue.findIndex(j => j.status === 'pending');
  if (index === -1) return null;

  const job = state.queue[index];
  const quota = CLASSES[job.type].dailyBudgetMinutes;
  const currentUsage = state.usage[job.type] || 0;

  if (currentUsage + job.estimatedMinutes > quota) {
    // Orçamento diário esgotado para esta classe
    return { error: 'Budget exceeded for class: ' + job.type, jobClass: job.type };
  }

  state.usage[job.type] = currentUsage + job.estimatedMinutes;
  job.status = 'running';
  saveState(state);
  return job;
}

function getQueueStatus() {
  const state = loadState();
  return {
    date: state.date,
    usage: state.usage,
    limits: {
      producao: CLASSES.producao.dailyBudgetMinutes,
      cliente: CLASSES.cliente.dailyBudgetMinutes,
      melhoria: CLASSES.melhoria.dailyBudgetMinutes
    },
    queueLength: state.queue.length,
    pending: state.queue.filter(j => j.status === 'pending').length
  };
}

module.exports = {
  CLASSES,
  enqueueJob,
  getNextJob,
  getQueueStatus,
  loadState
};
