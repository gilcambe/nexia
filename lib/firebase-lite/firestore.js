'use strict';
const VazaoController = { marcarCheio: () => {} };
// Limites e configurações de uso para cada banco
const BANK_LIMITS = {
  'firestore-default': { reads: 50000, writes: 20000, warnThreshold: 0.7 },
  'firestore-b': { reads: 50000, writes: 20000, warnThreshold: 0.7 },
  'firestore-c': { reads: 50000, writes: 20000, warnThreshold: 0.7 },
  'd1': { reads: 5000000, writes: 100000, warnThreshold: 0.7 },
  'cofresql': { reads: 50000000, writes: 10000000, warnThreshold: 0.7 }, // Valores altos como placeholder
};
const { createD1Backend } = require('./d1-backend');
const { CofreSql } = require('../../src/durable/CofreSql');

// Contador de uso por banco (leituras e escritas do dia) - persistente no VazaoController
const usoDiarioBancos = new Map(); // banco -> { data, leituras, escritas, limiteLeituras, limiteEscritas, status }

function registrarUsoBanco(banco, leituras = 0, escritas = 0) {
  const hoje = new Date().toISOString().slice(0, 10);
  const bancoKey = banco || 'firestore-default';
  let cur = usoDiarioBancos.get(bancoKey);
  const limits = BANK_LIMITS[bancoKey] || BANK_LIMITS['firestore-default'];

  if (!cur || cur.data !== hoje) {
    cur = { 
      data: hoje, 
      leituras: 0, 
      escritas: 0, 
      limiteLeituras: limits.reads, 
      limiteEscritas: limits.writes, 
      status: 'ativo' 
    };
    usoDiarioBancos.set(bancoKey, cur);
  }
  cur.leituras += leituras;
  cur.escritas += escritas;
  
  if (cur.leituras >= limits.reads * limits.warnThreshold || cur.escritas >= limits.writes * limits.warnThreshold) {
    cur.status = 'quase cheio';
    try {
      console.warn(`[SENTINEL ALERT] [sentinel] Banco ${bancoKey} atingiu 70% da cota (leituras: ${cur.leituras}/${limits.reads}, escritas: ${cur.escritas}/${limits.writes}). Alternando tráfego preventivamente.`);
      try { VazaoController?.marcarCheio?.(bancoKey, cur); } catch {}
    } catch (e) { console.error('Erro ao marcar banco no VazaoController', e); }
  } else {
    cur.status = 'ativo';
  }
}

function getUsoBanco(banco) {
  const bancoKey = banco || 'firestore-default';
  const limits = BANK_LIMITS[bancoKey] || BANK_LIMITS['firestore-default'];
  return usoDiarioBancos.get(bancoKey) || { 
    data: new Date().toISOString().slice(0, 10), 
    leituras: 0, 
    escritas: 0,
    limiteLeituras: limits.reads,
    limiteEscritas: limits.writes,
    status: 'ativo'
  };
}

function getBancosUsoGeral() {
  const res = [];
  for (const bancoKey of Object.keys(BANK_LIMITS)) {
    const st = getUsoBanco(bancoKey);
    res.push({ 
      banco: bancoKey, 
      status: st.status, 
      reads: st.leituras, 
      writes: st.escritas, 
      limiteReads: st.limiteLeituras, 
      limiteWrites: st.limiteEscritas 
    });
  }
  return res;
}

// Cache em memória (TTL 60 s) com proteção contra cache poisoning
const firestoreReadCache = new Map(); // key -> { expiresAt, record, hash }
const CACHE_TTL_MS = 60 * 1000;

function getCachedFirestoreRead(tenantId, collection, docId) {
  const k = `${tenantId}:${collection}:${docId}`;
  const entry = firestoreReadCache.get(k);
  if (entry && entry.expiresAt > Date.now()) {
    // Verificação de integridade do cache
    const currentHash = hashDocument(entry.record);
    if (currentHash === entry.hash) {
      return entry.record;
    }
    // Cache poisoning detectado, limpa
    firestoreReadCache.delete(k);
  }
  return null;
}

function setCachedFirestoreRead(tenantId, collection, docId, record) {
  const k = `${tenantId}:${collection}:${docId}`;
  const hash = hashDocument(record);
  firestoreReadCache.set(k, { 
    expiresAt: Date.now() + CACHE_TTL_MS, 
    record, 
    hash 
  });
}

function invalidateFirestoreCache(tenantId, collection, docId) {
  if (docId) {
    firestoreReadCache.delete(`${tenantId}:${collection}:${docId}`);
  } else {
    for (const k of firestoreReadCache.keys()) {
      if (k.startsWith(`${tenantId}:${collection}:`)) {
        firestoreReadCache.delete(k);
      }
    }
  }
}

function hashDocument(doc) {
  try {
    return require('crypto').createHash('sha256').update(JSON.stringify(doc)).digest('hex');
  } catch {
    return '0';
  }
}

// Rodízio de bancos: B -> C -> D1 -> CofreSql
// Rodízio de bancos atualizado com verificação de cota (70%)
const BANCO_RODIZIO = ['firestore-b', 'firestore-c', 'd1', 'cofresql'];
let currentBancoIndex = 0;

function getNextBank() {
  for (let i = 0; i < BANCO_RODIZIO.length; i++) { // Começa do banco atual e tenta todos
    const idx = (currentBancoIndex + i) % BANCO_RODIZIO.length;
    const banco = BANCO_RODIZIO[idx];
    if (checkBankHealth(banco)) {
      currentBancoIndex = idx; // Atualiza o índice do banco atual se encontrar um saudável
      return banco;
    }
  }
  // Se todos estiverem 'quase cheios', retorna o próximo do rodízio mesmo assim (para evitar loop infinito)
  currentBancoIndex = (currentBancoIndex + 1) % BANCO_RODIZIO.length;
  console.warn(`[VAULT] Todos os bancos estão quase cheios. Retornando o próximo banco no rodízio: ${BANCO_RODIZIO[currentBancoIndex]}`);
  return BANCO_RODIZIO[currentBancoIndex];
}

function switchToNextBank() {
  currentBancoIndex = (currentBancoIndex + 1) % BANCO_RODIZIO.length;
  console.log(`[VAULT] Trocou para banco: ${BANCO_RODIZIO[currentBancoIndex]}`);
  return BANCO_RODIZIO[currentBancoIndex];
}

function checkBankHealth(bancoKey) {
  const uso = getUsoBanco(bancoKey);
  // Um banco é considerado saudável se não estiver "quase cheio"
  return uso.status !== 'quase cheio';
}

module.exports = {
  registrarUsoBanco,
  getUsoBanco,
  getBancosUsoGeral,
  getCachedFirestoreRead,
  setCachedFirestoreRead,
  invalidateFirestoreCache,
  getNextBank,
  switchToNextBank,
  checkBankHealth
};
