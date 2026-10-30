'use strict';
const { VazaoController } = require('../durable/VazaoController.js');
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
      console.warn(`[SENTINEL ALERT] Banco Firestore (${bancoKey}) atingiu 70% da cota! Leituras: ${cur.leituras}, Escritas: ${cur.escritas}.`);
    } catch {}
  }
}

function getUsoFirestore(banco) {
  return usoDiarioFirestore.get(banco || 'firestore-default') || { data: new Date().toISOString().slice(0, 10), leituras: 0, escritas: 0 };
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
const BANCO_RODIZIO = ['firestore-b', 'firestore-c', 'd1', 'cofresql'];
let currentBancoIndex = 0;

function getNextBank() {
  return BANCO_RODIZIO[(currentBancoIndex + 1) % BANCO_RODIZIO.length];
}

function switchToNextBank() {
  currentBancoIndex = (currentBancoIndex + 1) % BANCO_RODIZIO.length;
  console.log(`[VAULT] Trocou para banco: ${BANCO_RODIZIO[currentBancoIndex]}`);
  return BANCO_RODIZIO[currentBancoIndex];
}

function checkBankHealth(banco) {
  // Simulação de verificação de saúde - na implementação real, verificaria conectividade e resposta
  if (banco === 'd1' || banco === 'cofresql') {
    return true; // Bancos secundários sempre saudáveis
  }
  // Para Firestore, verifica se o uso está abaixo de 70%
  const uso = getUsoFirestore(banco);
  const maxL = 50000;
  const maxE = 20000;
  return uso.leituras < maxL * 0.7 && uso.escritas < maxE * 0.7;
}
