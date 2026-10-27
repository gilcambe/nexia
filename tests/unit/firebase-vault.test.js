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

test('FV5. #2188: banco fora do ar (503 UNAVAILABLE) troca para o próximo e repete o pedido, sem devolver erro', async () => {
  const { Firestore } = require('../../lib/firebase-lite/firestore');
  const fetchImpl = async url => (url.includes('/projects/b/')
    ? { ok: false, status: 503, text: async () => JSON.stringify({ error: { status: 'UNAVAILABLE', message: 'down' } }) }
    : { ok: true, status: 200, text: async () => JSON.stringify({ commitTime: '2026-10-27T00:00:00Z', writeResults: [{}] }) });
  const bancos = ['b', 'c'].map(p => ({ projectId: p, getToken: async () => 't' }));
  const db = new Firestore({ projectId: 'b', getToken: bancos[0].getToken, fetchImpl });
  db.enableFailover(bancos);
  await db.collection('x').doc('1').set({ a: 1 });
  assert.equal(db.projectId, 'c');
});

test('FV6. #2188: quando a cota do B renova (07:00 UTC) o cliente volta do D1/C para o B sozinho', async () => {
  const { Firestore } = require('../../lib/firebase-lite/firestore');
  let agora = Date.UTC(2026, 9, 27, 3);
  let bSemCota = true;
  const vistos = [];
  const fetchImpl = async url => {
    vistos.push(url);
    if (url.includes('/projects/b/') && bSemCota) return { ok: false, status: 429, text: async () => JSON.stringify({ error: { status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded.' } }) };
    return { ok: true, status: 200, text: async () => JSON.stringify({ commitTime: '2026-10-27T00:00:00Z', writeResults: [{}] }) };
  };
  const bancos = ['b', 'c'].map(p => ({ projectId: p, getToken: async () => 't' }));
  const db = new Firestore({ projectId: 'b', getToken: bancos[0].getToken, fetchImpl });
  db.enableFailover(bancos, () => agora);
  await db.collection('x').doc('1').set({ a: 1 });
  assert.equal(db.projectId, 'c');
  await db.collection('x').doc('2').set({ a: 1 });
  assert.equal(db.projectId, 'c', 'antes das 07:00 continua no C');
  agora = Date.UTC(2026, 9, 27, 7, 1); bSemCota = false;
  await db.collection('x').doc('3').set({ a: 1 });
  assert.equal(db.projectId, 'b');
  assert.ok(vistos[vistos.length - 1].includes('/projects/b/'));
});

test('FV7. #2188: limite diário do D1 grátis vira RESOURCE_EXHAUSTED (falta de cota), não UNAVAILABLE', async () => {
  const { createD1Driver } = require('../../lib/firebase-lite/d1-backend');
  const fetchImpl = async () => ({ ok: false, status: 400, json: async () => ({ success: false, errors: [{ message: "Your account has exceeded D1's free tier daily row read limit." }] }) });
  const d = createD1Driver({ token: 't', accountId: 'a', databaseId: 'id', fetchImpl });
  await assert.rejects(() => d.get(['x/1']), e => (e.firestoreStatus || e.status) === 'RESOURCE_EXHAUSTED');
});
