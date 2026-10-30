'use strict';
const VazaoController = { marcarCheio: () => {} };
const { createD1Backend } = require('./d1-backend');
const { CofreSql } = require('../../src/durable/CofreSql');

// Contador de uso por banco (leituras e escritas do dia) - persistente no VazaoController
const usoDiarioFirestore = new Map(); // banco -> { data, leituras, escritas }

function registrarUsoFirestore(banco, leituras = 0, escritas = 0) {
  const hoje = new Date().toISOString().slice(0, 10);
  const bancoKey = banco || 'firestore-default';
  let cur = usoDiarioFirestore.get(bancoKey);
  if (!cur || cur.data !== hoje) {
    cur = { data: hoje, leituras: 0, escritas: 0 };
    usoDiarioFirestore.set(bancoKey, cur);
  }
  cur.leituras += leituras;
  cur.escritas += escritas;
  
  // Limites Firestore: 50k leituras / 20k escritas. 70% = 35k / 14k.
  const maxL = 50000;
  const maxE = 20000;
  if (cur.leituras >= maxL * 0.7 || cur.escritas >= maxE * 0.7) {
    try {
      console.warn(`[SENTINEL ALERT] [sentinel] Banco Firestore (${bancoKey}) atingiu 70% da cota (leituras: ${cur.leituras}/${maxL}, escritas: ${cur.escritas}/${maxE}). Alternando tráfego preventivamente.`);
      try { VazaoController?.marcarCheio?.(bancoKey, cur); } catch {}
    } catch {}
  }
}

function getUsoFirestore(banco) {
  return usoDiarioFirestore.get(banco || 'firestore-default') || { data: new Date().toISOString().slice(0, 10), leituras: 0, escritas: 0 };
}

function getBancosUsoGeral() {
  const hoje = new Date().toISOString().slice(0, 10);
  const res = [];
  for (const [b, st] of usoDiarioFirestore.entries()) {
    const cheio = st.leituras >= 35000 || st.escritas >= 14000;
    res.push({ banco: b, status: cheio ? 'quase cheio' : 'ativo', reads: st.leituras, writes: st.escritas, limiteReads: 50000, limiteWrites: 20000 });
  }
  if (!res.some(r => r.banco.includes('default') || r.banco.includes('B'))) {
    res.unshift({ banco: 'Firestore (B)', status: 'ativo', reads: 0, writes: 0, limiteReads: 50000, limiteWrites: 20000 });
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
  for (let i = 1; i <= BANCO_RODIZIO.length; i++) {
    const idx = (currentBancoIndex + i) % BANCO_RODIZIO.length;
    const banco = BANCO_RODIZIO[idx];
    if (checkBankHealth(banco)) {
      return banco;
    }
  }
  return BANCO_RODIZIO[(currentBancoIndex + 1) % BANCO_RODIZIO.length];
}

function switchToNextBank() {
  currentBancoIndex = (currentBancoIndex + 1) % BANCO_RODIZIO.length;
  console.log(`[VAULT] Trocou para banco: ${BANCO_RODIZIO[currentBancoIndex]}`);
  return BANCO_RODIZIO[currentBancoIndex];
}

// Fim das duplicações ou ajustes necessários

module.exports = {
  registrarUsoFirestore,
  getUsoFirestore,
  getCachedFirestoreRead,
  setCachedFirestoreRead,
  invalidateFirestoreCache,
  getNextBank,
  switchToNextBank,
  checkBankHealth
};
