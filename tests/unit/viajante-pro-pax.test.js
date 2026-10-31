'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../../netlify/functions/viajante-pro').handler;

// Mock em memória para Firestore
class MockDoc {
  constructor(data = null) {
    this._data = data;
    this.exists = !!data;
  }
  data() { return this._data; }
}

class MockCollection {
  constructor() {
    this.docsMap = new Map();
  }
  doc(id) {
    const col = this;
    return {
      get: async () => new MockDoc(col.docsMap.get(id) || null),
      set: async (data, opts) => {
        const cur = col.docsMap.get(id) || {};
        const finalData = (opts && opts.merge) ? { ...cur, ...data } : data;
        col.docsMap.set(id, finalData);
      },
      update: async (data) => {
        const cur = col.docsMap.get(id) || {};
        col.docsMap.set(id, { ...cur, ...data });
      },
      delete: async () => { col.docsMap.delete(id); },
      collection: (sub) => col._sub(id, sub),
    };
  }
  _sub(docId, subName) {
    const key = `${docId}/${subName}`;
    if (!this.subs) this.subs = new Map();
    if (!this.subs.has(key)) this.subs.set(key, new MockCollection());
    return this.subs.get(key);
  }
  get docs() {
    const list = [];
    for (const [id, data] of this.docsMap.entries()) {
      list.push({ id, data: () => data });
    }
    return list;
  }
  async get() {
    return {
      docs: this.docs,
      empty: this.docsMap.size === 0,
      size: this.docsMap.size,
    };
  }
  where(field, op, val) {
    const self = this;
    return {
      async get() {
        const matches = [];
        for (const [id, data] of self.docsMap.entries()) {
          if (op === '==' && data[field] === val) {
            matches.push({ id, data: () => data });
          }
        }
        return { docs: matches, empty: matches.length === 0, size: matches.length };
      }
    };
  }
}

function setupMock() {
  const root = new MockCollection();
  globalThis.__NEXIA_FIRESTORE_MOCK__ = {
    collection: (name) => root,
  };
  return root;
}

test('Kernex VP 7: Código errado 3 vezes bloqueia por 15 min', async () => {
  setupMock();

  // 1. Solicita código
  const resCod = await handler({
    httpMethod: 'POST',
    body: JSON.stringify({ acao: 'pax-codigo', email: 'pax@teste.com' }),
  });
  assert.strictEqual(resCod.statusCode, 200);

  // 2. Erra código 1ª vez
  const err1 = await handler({
    httpMethod: 'POST',
    body: JSON.stringify({ acao: 'pax-entrar', email: 'pax@teste.com', codigo: '000000' }),
  });
  assert.strictEqual(err1.statusCode, 400);

  // 3. Erra código 2ª vez
  const err2 = await handler({
    httpMethod: 'POST',
    body: JSON.stringify({ acao: 'pax-entrar', email: 'pax@teste.com', codigo: '000000' }),
  });
  assert.strictEqual(err2.statusCode, 400);

  // 4. Erra código 3ª vez -> bloqueio ativado (403)
  const err3 = await handler({
    httpMethod: 'POST',
    body: JSON.stringify({ acao: 'pax-entrar', email: 'pax@teste.com', codigo: '000000' }),
  });
  assert.strictEqual(err3.statusCode, 403);
  assert.match(err3.body, /bloqueada por 15 minutos/i);
});

test('Kernex VP 7: Passageiro A não lê viagem do Passageiro B (403)', async () => {
  const root = setupMock();
  const contaRef = root.doc('viajantepro');

  // Criar viagem do Passageiro B
  await contaRef.collection('viagens').doc('v_pax_b').set({
    id: 'v_pax_b',
    nome: 'Viagem de B',
    email: 'passageiroB@teste.com',
    passageiros: [{ nome: 'Passageiro B', email: 'passageiroB@teste.com' }],
  });

  // Criar sessão para Passageiro A
  const crypto = require('node:crypto');
  const tokenA = 'token_pax_a';
  const tokenAHash = crypto.createHash('sha256').update(tokenA).digest('hex');

  await contaRef.collection('pax_sessoes').doc(tokenAHash).set({
    email: 'passageiroA@teste.com',
    perfil: 'passageiro',
    expira_em: new Date(Date.now() + 86400000).toISOString(),
  });

  // Passageiro A tenta acessar a viagem de B
  const res = await handler({
    httpMethod: 'POST',
    headers: { authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ acao: 'pax-minhas', viagem_id: 'v_pax_b' }),
  });

  assert.strictEqual(res.statusCode, 403);
  assert.match(res.body, /Acesso negado/i);
});
