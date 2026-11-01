'use strict';
// Teste unitário do monitoramento do Vault na Central (saude-historico.js)
const assert = require('node:assert/strict');

// db fake que simula coleção vault_usage
class FakeDocRef {
  constructor(data = {}) {
    this.data = data;
    this.exists = Object.keys(data).length > 0;
  }
  async get() { return this; }
  async update(dados) { Object.assign(this.data, dados); return this; }
  async set(dados) { this.data = dados; this.exists = true; return this; }
}

class FakeCollection {
  constructor() {
    this.docs = [];
    this._docsMap = {};
  }
  doc(id) {
    if (!this._docsMap[id]) this._docsMap[id] = new FakeDocRef();
    return this._docsMap[id];
  }
  async where() { return this; }
  async orderBy() { return this; }
  async limit() { return this; }
  async get() {
    return { docs: Object.values(this._docsMap), empty: Object.keys(this._docsMap).length === 0 };
  }
  async batch() {
    const writes = [];
    return {
      delete(ref) { writes.push({ type: 'delete', ref }); },
      async commit() { writes.length = 0; return { commitTime: new Date().toISOString() }; }
    };
  }
}

const db = { collection: (nome) => { const c = new FakeCollection(); return c; } };

const mod = require('../../netlify/functions/central/saude-historico.js');

const hoje = new Date().toISOString().slice(0, 10);

async function main() {
  // guardarUsoVault - cria novo registro
  const r1 = await mod.guardarUsoVault(db, {
    banco: 'firestore-b',
    leituras: 35000,
    escritas: 14000,
    percentualLeituras: 70,
    percentualEscritas: 70,
    status: 'quase cheio'
  }, hoje);
  assert.equal(r1.success, true);

  // guardarUsoVault - atualiza registro existente
  const r2 = await mod.guardarUsoVault(db, {
    banco: 'firestore-b',
    leituras: 40000,
    escritas: 16000,
    percentualLeituras: 80,
    percentualEscritas: 80,
    status: 'quase cheio'
  }, hoje);
  assert.equal(r2.success, true);

  // obterUsoVault - retorna os dados salvos
  const r3 = await mod.obterUsoVault(db, hoje);
  assert.equal(r3.success, true);
  assert.ok(r3.bancos['firestore-b']);
  assert.equal(r3.bancos['firestore-b'].leituras, 40000);
  assert.equal(r3.bancos['firestore-b'].escritas, 16000);

  // obterUsoVault - banco sem dados retorna vazio
  const r4 = await mod.obterUsoVault(db, hoje);
  assert.ok(!r4.bancos['d1']);

  // historicoUsoVault - retorna histórico com a data
  const r5 = await mod.historicoUsoVault(db, 7);
  assert.equal(r5.success, true);
  assert.ok(r5.historico[hoje]);

  console.log('OK: monitoramento do Vault na Central');
}

main().catch((e) => { console.error(e); process.exit(1); });
