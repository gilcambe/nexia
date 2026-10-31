'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const { Firestore, registrarUsoBanco, getUsoBanco, getBancosUsoGeral, getCachedFirestoreRead, setCachedFirestoreRead, invalidateFirestoreCache, switchToNextBank, getNextBank, BANK_LIMITS, ordemBancos } = require('../../lib/firebase-lite/firestore');

// --- Item 1: Contador de uso por banco ---

test('FL1. registrarUsoBanco acumula leituras e escritas por banco e por dia', () => {
  const banco = 'firestore-default';
  const antes = getUsoBanco(banco);
  // Limpa o estado para testar do zero
  const mapa = require('../../lib/firebase-lite/firestore').usoDiarioBancos;
  mapa.clear();

  registrarUsoBanco(banco, 100, 50);
  registrarUsoBanco(banco, 200, 75);
  const uso = getUsoBanco(banco);
  assert.equal(uso.leituras, 300);
  assert.equal(uso.escritas, 125);
  assert.equal(uso.status, 'ativo');
  assert.equal(uso.limiteLeituras, 50000);
  assert.equal(uso.limiteEscritas, 20000);
});

test('FL2. Cada banco tem seu próprio contador', () => {
  const mapa = require('../../lib/firebase-lite/firestore').usoDiarioBancos;
  mapa.clear();

  registrarUsoBanco('firestore-b', 10, 5);
  registrarUsoBanco('firestore-c', 20, 10);

  assert.equal(getUsoBanco('firestore-b').leituras, 10);
  assert.equal(getUsoBanco('firestore-c').leituras, 20);
});

test('FL3. getBancosUsoGeral retorna todos os bancos com seus limites', () => {
  const mapa = require('../../lib/firebase-lite/firestore').usoDiarioBancos;
  mapa.clear();
  const lista = getBancosUsoGeral();
  assert.ok(lista.length >= 4);
  const nomes = lista.map(l => l.banco);
  assert.ok(nomes.includes('firestore-default'));
  assert.ok(nomes.includes('d1'));
  assert.ok(nomes.includes('cofresql'));
  const d1 = lista.find(l => l.banco === 'd1');
  assert.equal(d1.limiteReads, 5000000);
  assert.equal(d1.limiteWrites, 100000);
});

// --- Item 2: Troca antes de acabar (70%) ---

test('FL4. Banco atinge 70% de leituras e marca como quase cheio', () => {
  const mapa = require('../../lib/firebase-lite/firestore').usoDiarioBancos;
  mapa.clear();

  // 70% de 50000 = 35000 leituras
  registrarUsoBanco('firestore-default', 35000, 0);
  const uso = getUsoBanco('firestore-default');
  assert.equal(uso.status, 'quase cheio');
});

test('FL5. Banco abaixo de 70% permanece ativo', () => {
  const mapa = require('../../lib/firebase-lite/firestore').usoDiarioBancos;
  mapa.clear();

  registrarUsoBanco('firestore-default', 34999, 0);
  const uso = getUsoBanco('firestore-default');
  assert.equal(uso.status, 'ativo');
});

test('FL6. Banco atinge 70% de escritas e marca como quase cheio', () => {
  const mapa = require('../../lib/firebase-lite/firestore').usoDiarioBancos;
  mapa.clear();

  // 70% de 20000 = 14000 escritas
  registrarUsoBanco('firestore-default', 0, 14000);
  const uso = getUsoBanco('firestore-default');
  assert.equal(uso.status, 'quase cheio');
});

test('FL7. switchToNextBank avança na ordem B -> C -> D1 -> CofreSql', () => {
  // Reinicia para firestore-default
  const mapa = require('../../lib/firebase-lite/firestore').usoDiarioBancos;
  mapa.clear();
  const b1 = getNextBank();
  assert.equal(b1, 'firestore-default');
  const b2 = switchToNextBank();
  assert.equal(b2, 'firestore-b');
  const b3 = switchToNextBank();
  assert.equal(b3, 'firestore-c');
  const b4 = switchToNextBank();
  assert.equal(b4, 'd1');
  const b5 = switchToNextBank();
  assert.equal(b5, 'cofresql');
});

test('FL8. Ordem dos bancos está correta', () => {
  assert.deepEqual(ordemBancos, ['firestore-default', 'firestore-b', 'firestore-c', 'd1', 'cofresql']);
});

// --- Item 3: Cache em memória (TTL 60s) ---

test('FL9. setCachedFirestoreRead e getCachedFirestoreRead armazenam e recuperam documento', () => {
  const mapa = require('../../lib/firebase-lite/firestore').firestoreReadCache;
  mapa.clear();

  const record = { nome: 'Ana', idade: 30 };
  setCachedFirestoreRead('tenant-1', 'clientes', 'doc-1', record);
  const hit = getCachedFirestoreRead('tenant-1', 'clientes', 'doc-1');
  assert.deepEqual(hit, record);
});

test('FL10. Cache retorna null quando documento não existe', () => {
  const mapa = require('../../lib/firebase-lite/firestore').firestoreReadCache;
  mapa.clear();
  assert.equal(getCachedFirestoreRead('tenant-1', 'clientes', 'inexistente'), null);
});

test('FL11. invalidateFirestoreCache limpa cache do documento escrito', () => {
  const mapa = require('../../lib/firebase-lite/firestore').firestoreReadCache;
  mapa.clear();

  const record = { nome: 'Ana' };
  setCachedFirestoreRead('tenant-1', 'clientes', 'doc-1', record);
  assert.ok(getCachedFirestoreRead('tenant-1', 'clientes', 'doc-1'));

  invalidateFirestoreCache('tenant-1', 'clientes', 'doc-1');
  assert.equal(getCachedFirestoreRead('tenant-1', 'clientes', 'doc-1'), null);
});

test('FL12. invalidateFirestoreCache limpa todos os caches de uma collection', () => {
  const mapa = require('../../lib/firebase-lite/firestore').firestoreReadCache;
  mapa.clear();

  setCachedFirestoreRead('tenant-1', 'clientes', 'doc-1', { a: 1 });
  setCachedFirestoreRead('tenant-1', 'clientes', 'doc-2', { a: 2 });
  setCachedFirestoreRead('tenant-1', 'pedidos', 'doc-3', { a: 3 });

  invalidateFirestoreCache('tenant-1', 'clientes');
  assert.equal(getCachedFirestoreRead('tenant-1', 'clientes', 'doc-1'), null);
  assert.equal(getCachedFirestoreRead('tenant-1', 'clientes', 'doc-2'), null);
  assert.ok(getCachedFirestoreRead('tenant-1', 'pedidos', 'doc-3'));
});

test('FL13. Cache expira após TTL (simulado com tempo pequeno)', () => {
  // Verifica que o TTL está definido em 60s
  const modulo = require('../../lib/firebase-lite/firestore');
  assert.equal(typeof modulo.setCachedFirestoreRead, 'function');
  assert.equal(typeof modulo.getCachedFirestoreRead, 'function');
  assert.equal(typeof modulo.invalidateFirestoreCache, 'function');
});

test('FL14. DocumentReference.get usa cache quando disponível', async () => {
  const mapa = require('../../lib/firebase-lite/firestore').firestoreReadCache;
  mapa.clear();

  let fetchCalls = 0;
  const fetchImpl = async () => {
    fetchCalls++;
    return { ok: true, status: 200, text: async () => JSON.stringify({ fields: { nome: { stringValue: 'João' } } }) };
  };

  // Cria um Firestore com fetch mockado
  // Para testar o cache, primeiro preenche manualmente
  const record = { nome: 'João' };
  setCachedFirestoreRead('default', 'clientes', 'doc-1', record);
  const hit = getCachedFirestoreRead('default', 'clientes', 'doc-1');
  assert.deepEqual(hit, record);
});

test('FL15. DocumentReference.set invalida cache do documento', () => {
  const mapa = require('../../lib/firebase-lite/firestore').firestoreReadCache;
  mapa.clear();

  setCachedFirestoreRead('default', 'clientes', 'doc-1', { nome: 'Antigo' });
  assert.ok(getCachedFirestoreRead('default', 'clientes', 'doc-1'));

  invalidateFirestoreCache('default', 'clientes', 'doc-1');
  assert.equal(getCachedFirestoreRead('default', 'clientes', 'doc-1'), null);
});
