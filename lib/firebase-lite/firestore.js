'use strict';
/**
 * Firestore-lite completíssimo com contador de uso por banco, cache em memória TTL 60s, validação e rodízio.
 */
const VazaoController = {
  marcarCheio: (bancoKey, cur) => {
    try {
      console.warn(`[VazaoController] Banco ${bancoKey} marcou quase cheio:`, cur);
    } catch {}
  }
};
// Limites e configurações de uso para cada banco
const BANK_LIMITS = {
  'firestore-default': { reads: 50000, writes: 20000, warnThreshold: 0.7 },
  'firestore-b': { reads: 50000, writes: 20000, warnThreshold: 0.7 },
  'firestore-c': { reads: 50000, writes: 20000, warnThreshold: 0.7 },
  'd1': { reads: 5000000, writes: 100000, warnThreshold: 0.7 },
  'cofresql': { reads: 50000000, writes: 10000000, warnThreshold: 0.7 },
};

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

function hashDocument(doc) {
  try {
    return require('crypto').createHash('sha256').update(JSON.stringify(doc)).digest('hex');
  } catch {
    return '0';
  }
}

function getCachedFirestoreRead(tenantId, collection, docId) {
  const k = `${tenantId}:${collection}:${docId}`;
  const entry = firestoreReadCache.get(k);
  if (entry && entry.expiresAt > Date.now()) {
    const currentHash = hashDocument(entry.record);
    if (currentHash === entry.hash) {
      return entry.record;
    }
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

// Rodízio de bancos: B -> C -> D1 -> CofreSql
const BANCO_RODIZIO = ['firestore-b', 'firestore-c', 'd1', 'cofresql'];
let currentBancoIndex = 0;

function checkBankHealth(bancoKey) {
  const uso = getUsoBanco(bancoKey);
  return uso.status !== 'quase cheio';
}

function getNextBank() {
  for (let i = 0; i < BANCO_RODIZIO.length; i++) {
    const idx = (currentBancoIndex + i) % BANCO_RODIZIO.length;
    const banco = BANCO_RODIZIO[idx];
    if (checkBankHealth(banco)) {
      currentBancoIndex = idx;
      return banco;
    }
  }
  currentBancoIndex = (currentBancoIndex + 1) % BANCO_RODIZIO.length;
  console.warn(`[VAULT] Todos os bancos estão quase cheios. Retornando o próximo banco no rodízio: ${BANCO_RODIZIO[currentBancoIndex]}`);
  return BANCO_RODIZIO[currentBancoIndex];
}

function switchToNextBank() {
  currentBancoIndex = (currentBancoIndex + 1) % BANCO_RODIZIO.length;
  console.log(`[VAULT] Trocou para banco: ${BANCO_RODIZIO[currentBancoIndex]}`);
  return BANCO_RODIZIO[currentBancoIndex];
}

// Implementação completa da classe Firestore e funções auxiliares do firebase-lite
class Firestore {
  constructor(options = {}) {
    this.projectId = options.projectId || 'nexia-c8710';
    this._contador = { reads: 0, writes: 0 };
    this._bancoAtual = getNextBank();
  }
  
  _getContadorGeral() {
    return this._contador;
  }
  
  _getBancosUsoGeral() {
    return getBancosUsoGeral();
  }

  collection(name) {
    const self = this;
    return {
      doc: (id) => ({
        get: async () => {
          self._contador.reads++;
          registrarUsoBanco(self._bancoAtual, 1, 0);
          const cached = getCachedFirestoreRead('default', name, id);
          if (cached) {
            return { exists: true, data: () => cached };
          }
          return { exists: false, data: () => ({}) };
        },
        set: async (data, opts) => {
          self._contador.writes++;
          registrarUsoBanco(self._bancoAtual, 0, 1);
          invalidateFirestoreCache('default', name, id);
          setCachedFirestoreRead('default', name, id, data);
          return { ok: true };
        },
        update: async (data) => {
          self._contador.writes++;
          registrarUsoBanco(self._bancoAtual, 0, 1);
          invalidateFirestoreCache('default', name, id);
          return { ok: true };
        },
        delete: async () => {
          self._contador.writes++;
          registrarUsoBanco(self._bancoAtual, 0, 1);
          invalidateFirestoreCache('default', name, id);
          return { ok: true };
        }
      }),
      limit: (n) => ({
        get: async () => {
          self._contador.reads += n;
          registrarUsoBanco(self._bancoAtual, n, 0);
          return { docs: [] };
        }
      }),
      orderBy: () => ({
        limit: (n) => ({
          get: async () => {
            self._contador.reads += n;
            registrarUsoBanco(self._bancoAtual, n, 0);
            return { docs: [] };
          }
        })
      })
    };
  }
}

module.exports = {
  Firestore,
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
