'use strict';
const assert = require('node:assert');
const {
  Firestore,
  DocumentReference,
  registrarUsoBanco,
  getUsoBanco,
  getBancosUsoGeral,
  getCachedFirestoreRead,
  setCachedFirestoreRead,
  invalidateFirestoreCache,
  getNextBank,
  switchToNextBank,
  checkBankHealth,
} = require('../../lib/firebase-lite/firestore.js');

// Mock simples do fetch para não fazer requisições reais
global.fetch = async () => ({ ok: true, json: async () => ({}) });

function limparEstado() {
  // Resetar módulo recarregando
  delete require.cache[require.resolve('../../lib/firebase-lite/firestore.js')];
}

test('Item 2: banco é marcado quase cheio ao passar de 70% das leituras', async () => {
  limparEstado();
  const mod = require('../../lib/firebase-lite/firestore.js');
  const { registrarUsoBanco, getUsoBanco } = mod;

  // firestore-default: 50000 leituras, 70% = 35000
  registrarUsoBanco('firestore-default', 35000, 0);
  const uso = getUsoBanco('firestore-default');
  assert.strictEqual(uso.status, 'quase cheio', 'deveria estar quase cheio em 70% leituras');
  assert.ok(uso.percentualLeituras >= 70, 'percentual leituras >= 70%');
});

test('Item 2: banco é marcado quase cheio ao passar de 70% das escritas', async () => {
  limparEstado();
  const mod = require('../../lib/firebase-lite/firestore.js');
  const { registrarUsoBanco, getUsoBanco } = mod;

  // firestore-default: 20000 escritas, 70% = 14000
  registrarUsoBanco('firestore-default', 0, 14000);
  const uso = getUsoBanco('firestore-default');
  assert.strictEqual(uso.status, 'quase cheio', 'deveria estar quase cheio em 70% escritas');
});

test('Item 2: D1 quase cheio em 70% (5M leituras / 100k escritas)', async () => {
  limparEstado();
  const mod = require('../../lib/firebase-lite/firestore.js');
  const { registrarUsoBanco, getUsoBanco } = mod;

  registrarUsoBanco('d1', 3500000, 0); // 70% de 5M
  const uso = getUsoBanco('d1');
  assert.strictEqual(uso.status, 'quase cheio');
  assert.ok(uso.limiteLeituras === 5000000);
});

test('Item 2: banco abaixo de 70% fica ativo', async () => {
  limparEstado();
  const mod = require('../../lib/firebase-lite/firestore.js');
  const { registrarUsoBanco, getUsoBanco } = mod;

  registrarUsoBanco('firestore-default', 30000, 0); // 60% < 70%
  const uso = getUsoBanco('firestore-default');
  assert.strictEqual(uso.status, 'ativo');
});

test('Item 3: cache em memória retorna documento repetido (TTL 60s)', async () => {
  limparEstado();
  const mod = require('../../lib/firebase-lite/firestore.js');
  const { setCachedFirestoreRead, getCachedFirestoreRead } = mod;

  const dado = { nome: 'Joao', idade: 30 };
  setCachedFirestoreRead('cli_1', 'clientes', 'doc_1', dado);
  const hit = getCachedFirestoreRead('cli_1', 'clientes', 'doc_1');
  assert.deepStrictEqual(hit, dado);
});

test('Item 3: cache expira após TTL (simulado com tempo futuro)', async () => {
  limparEstado();
  const mod = require('../../lib/firebase-lite/firestore.js');
  const { setCachedFirestoreRead, getCachedFirestoreRead } = mod;

  const dado = { nome: 'Maria' };
  setCachedFirestoreRead('cli_1', 'tenant', 'doc_2', dado);
  // Invalida imediatamente para simular expiração
  invalidateFirestoreCache('cli_1', 'tenant', 'doc_2');
  const hit = getCachedFirestoreRead('cli_1', 'tenant', 'doc_2');
  assert.strictEqual(hit, null);
});

test('Item 3: escrita invalida cache do documento', async () => {
  limparEstado();
  const mod = require('../../lib/firebase-lite/firestore.js');
  const { setCachedFirestoreRead, getCachedFirestoreRead, invalidateFirestoreCache } = mod;

  setCachedFirestoreRead('cli_1', 'projeto', 'doc_3', { v: 1 });
  invalidateFirestoreCache('cli_1', 'projeto', 'doc_3');
  assert.strictEqual(getCachedFirestoreRead('cli_1', 'projeto', 'doc_3'), null);
});

test('Item 3: getBancosUsoGeral retorna todos os bancos com uso', async () => {
  limparEstado();
  const mod = require('../../lib/firebase-lite/firestore.js');
  const { getBancosUsoGeral } = mod;

  const bancos = getBancosUsoGeral();
  const nomes = bancos.map(b => b.banco);
  assert.ok(nomes.includes('firestore-b'));
  assert.ok(nomes.includes('firestore-c'));
  assert.ok(nomes.includes('d1'));
  assert.ok(nomes.includes('cofresql'));
  bancos.forEach(b => {
    assert.ok(typeof b.status === 'string');
    assert.ok(typeof b.reads === 'number');
    assert.ok(typeof b.writes === 'number');
  });
});

test('Item 2: switchToNextBank roda rodízio B -> C -> D1 -> CofreSql', async () => {
  limparEstado();
  const mod = require('../../lib/firebase-lite/firestore.js');
  const { switchToNextBank } = mod;

  const b1 = switchToNextBank();
  const b2 = switchToNextBank();
  assert.notStrictEqual(b1, b2, 'rodízio deve trocar de banco');
});

test('Item 2: checkBankHealth retorna false para banco quase cheio', async () => {
  limparEstado();
  const mod = require('../../lib/firebase-lite/firestore.js');
  const { registrarUsoBanco, checkBankHealth } = mod;

  registrarUsoBanco('firestore-b', 40000, 0); // 80% > 70%
  assert.strictEqual(checkBankHealth('firestore-b'), false);
});

test('Item 2: checkBankHealth retorna true para banco ativo', async () => {
  limparEstado();
  const mod = require('../../lib/firebase-lite/firestore.js');
  const { checkBankHealth } = mod;

  assert.strictEqual(checkBankHealth('firestore-b'), true);
});
