'use strict';
const {
  Firestore,
  DocumentReference,
  CollectionReference,
  registrarUsoBanco,
  getUsoBanco,
  getBancosUsoGeral,
  getCachedFirestoreRead,
  setCachedFirestoreRead,
  invalidateFirestoreCache,
  getNextBank,
  switchToNextBank,
  checkBankHealth
} = require('../../lib/firebase-lite/firestore.js');

// Força reset dos módulos entre testes usando re-require
function resetModule() {
  delete require.cache[require.resolve('../../lib/firebase-lite/firestore.js')];
}

describe('firestore.js - contador de uso por banco', () => {
  beforeEach(() => {
    resetModule();
  });

  test('registrarUsoBanco acumula leituras e escritas do dia', () => {
    const mod = require('../../lib/firebase-lite/firestore.js');
    mod.registrarUsoBanco('firestore-default', 10, 5);
    mod.registrarUsoBanco('firestore-default', 5, 3);
    const uso = mod.getUsoBanco('firestore-default');
    expect(uso.leituras).toBe(15);
    expect(uso.escritas).toBe(8);
  });

  test('registrarUsoBanco marca quase cheio acima de 70% leituras', () => {
    const mod = require('../../lib/firebase-lite/firestore.js');
    // Limite de leituras: 50000. 70% = 35000
    mod.registrarUsoBanco('firestore-b', 35001, 0);
    const uso = mod.getUsoBanco('firestore-b');
    expect(uso.status).toBe('quase cheio');
  });

  test('registrarUsoBanco marca quase cheio acima de 70% escritas', () => {
    const mod = require('../../lib/firebase-lite/firestore.js');
    // Limite de escritas: 20000. 70% = 14000
    mod.registrarUsoBanco('firestore-c', 0, 14001);
    const uso = mod.getUsoBanco('firestore-c');
    expect(uso.status).toBe('quase cheio');
  });

  test('getBancosUsoGeral retorna todos os bancos do rodízio', () => {
    const mod = require('../../lib/firebase-lite/firestore.js');
    const bancos = mod.getBancosUsoGeral();
    const nomes = bancos.map(b => b.banco).sort();
    expect(nomes).toEqual(['cofresql', 'd1', 'firestore-b', 'firestore-c', 'firestore-default']);
    for (const b of bancos) {
      expect(b).toHaveProperty('status');
      expect(b).toHaveProperty('reads');
      expect(b).toHaveProperty('writes');
      expect(b).toHaveProperty('limiteReads');
      expect(b).toHaveProperty('limiteWrites');
    }
  });
});

describe('firestore.js - troca proativa antes de acabar', () => {
  beforeEach(() => {
    resetModule();
  });

  test('getNextBank retorna um banco saudável', () => {
    const mod = require('../../lib/firebase-lite/firestore.js');
    const banco = mod.getNextBank();
    expect(['firestore-b', 'firestore-c', 'd1', 'cofresql']).toContain(banco);
  });

  test('checkBankHealth retorna falso para banco quase cheio', () => {
    const mod = require('../../lib/firebase-lite/firestore.js');
    mod.registrarUsoBanco('d1', 3500001, 0); // 70% de 5M
    expect(mod.checkBankHealth('d1')).toBe(false);
  });

  test('switchToNextBank avança o índice do rodízio', () => {
    const mod = require('../../lib/firebase-lite/firestore.js');
    const antes = mod.getNextBank();
    const depois = mod.switchToNextBank();
    expect(depois).not.toBe(antes);
  });
});

describe('firestore.js - cache em memória TTL 60s', () => {
  beforeEach(() => {
    resetModule();
  });

  test('setCachedFirestoreRead e getCachedFirestoreRead armazenam e retornam dados', () => {
    const mod = require('../../lib/firebase-lite/firestore.js');
    const record = { nome: 'Cliente A', tenant: 't1' };
    mod.setCachedFirestoreRead('t1', 'clientes', 'cli-1', record);
    const cached = mod.getCachedFirestoreRead('t1', 'clientes', 'cli-1');
    expect(cached).toEqual(record);
  });

  test('getCachedFirestoreRead retorna null para chave inexistente', () => {
    const mod = require('../../lib/firebase-lite/firestore.js');
    const cached = mod.getCachedFirestoreRead('t1', 'clientes', 'inexistente');
    expect(cached).toBeNull();
  });

  test('invalidateFirestoreCache remove o documento da escrita', () => {
    const mod = require('../../lib/firebase-lite/firestore.js');
    const record = { nome: 'Cliente A' };
    mod.setCachedFirestoreRead('t1', 'clientes', 'cli-1', record);
    expect(mod.getCachedFirestoreRead('t1', 'clientes', 'cli-1')).toEqual(record);
    mod.invalidateFirestoreCache('t1', 'clientes', 'cli-1');
    expect(mod.getCachedFirestoreRead('t1', 'clientes', 'cli-1')).toBeNull();
  });

  test('invalidateFirestoreCache sem docId limpa coleção do tenant', () => {
    const mod = require('../../lib/firebase-lite/firestore.js');
    mod.setCachedFirestoreRead('t1', 'clientes', 'cli-1', { nome: 'A' });
    mod.setCachedFirestoreRead('t1', 'clientes', 'cli-2', { nome: 'B' });
    mod.setCachedFirestoreRead('t2', 'clientes', 'cli-1', { nome: 'C' });
    mod.invalidateFirestoreCache('t1', 'clientes');
    expect(mod.getCachedFirestoreRead('t1', 'clientes', 'cli-1')).toBeNull();
    expect(mod.getCachedFirestoreRead('t1', 'clientes', 'cli-2')).toBeNull();
    expect(mod.getCachedFirestoreRead('t2', 'clientes', 'cli-1')).toEqual({ nome: 'C' });
  });
});

describe('firestore.js - DocumentReference usa cache e contador', () => {
  beforeEach(() => {
    resetModule();
  });

  test('DocumentReference.get usa cache quando disponível', async () => {
    const mod = require('../../lib/firebase-lite/firestore.js');
    const firestore = new mod.Firestore({ projectId: 'test' });
    // Pré-carrega cache
    mod.setCachedFirestoreRead('default', 'usuarios', 'user-1', { email: 'a@b.com' });
    const doc = firestore.collection('usuarios').doc('user-1');
    const snap = await doc.get();
    expect(snap.exists).toBe(true);
    expect(snap.data()).toEqual({ email: 'a@b.com' });
  });

  test('DocumentReference.set invalida cache do documento', async () => {
    const mod = require('../../lib/firebase-lite/firestore.js');
    const firestore = new mod.Firestore({ projectId: 'test' });
    mod.setCachedFirestoreRead('default', 'usuarios', 'user-1', { email: 'a@b.com' });
    await firestore.collection('usuarios').doc('user-1').set({ email: 'novo@b.com' });
    const snap = await firestore.collection('usuarios').doc('user-1').get();
    expect(snap.data()).toEqual({ email: 'novo@b.com' });
  });
});

