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
