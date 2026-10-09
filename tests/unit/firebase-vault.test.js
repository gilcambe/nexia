'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const { lerConta, criarBancoB } = require('../../netlify/functions/firebase-vault');

function conta() {
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  return { project_id: 'nexia-cortex-b', client_email: 'x@nexia-cortex-b.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
}

test('FV1. sem segredo B não há segundo banco (usa o principal)', () => {
  assert.equal(lerConta({}), null);
  assert.equal(criarBancoB({}), null);
});

test('FV2. segredo B em JSON puro ou em base64 vira um Firestore do outro projeto', () => {
  const sa = conta();
  assert.equal(criarBancoB({ FIREBASE_SERVICE_ACCOUNT_B: JSON.stringify(sa) }).projectId, 'nexia-cortex-b');
  assert.equal(criarBancoB({ FIREBASE_SERVICE_ACCOUNT_BASE64_B: Buffer.from(JSON.stringify(sa)).toString('base64') }).projectId, 'nexia-cortex-b');
});

test('FV3. segredo B incompleto falha com mensagem sem vazar a chave', () => {
  assert.throws(() => lerConta({ FIREBASE_SERVICE_ACCOUNT_B: JSON.stringify({ project_id: 'p' }) }), /incompleta/);
});

test('FV4. rodízio: B esgotado troca para C e repete o pedido; C esgotado também sem banco livre falha', async () => {
  const { Firestore } = require('../../lib/firebase-lite/firestore');
  const vistos = [];
  const fetchImpl = async (url, o) => {
    vistos.push(url);
    if (url.includes('/projects/b/')) return { ok: false, status: 429, text: async () => JSON.stringify({ error: { status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded.' } }) };
    return { ok: true, status: 200, text: async () => JSON.stringify({ commitTime: '2026-10-09T00:00:00Z', writeResults: [{}] }) };
  };
  const bancos = ['b', 'c'].map(p => ({ projectId: p, getToken: async () => 't' }));
  const db = new Firestore({ projectId: 'b', getToken: bancos[0].getToken, fetchImpl });
  db.enableFailover(bancos);
  await db.collection('x').doc('1').set({ a: 1 });
  assert.equal(db.projectId, 'c');
  assert.ok(vistos[0].includes('/projects/b/') && vistos[1].includes('/projects/c/'));
  assert.equal(db.bancoTrocas, 1);
  const so = new Firestore({ projectId: 'b', getToken: async () => 't', fetchImpl });
  so.enableFailover([bancos[0]]);
  await assert.rejects(() => so.collection('x').doc('1').set({ a: 1 }), /RESOURCE_EXHAUSTED/);
});
