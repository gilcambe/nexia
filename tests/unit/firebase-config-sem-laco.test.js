'use strict';
// Site principal (Central, Cortex): pedir a config do Firebase não pode pedir o token antes.
// O token chama initFirebase(), que pede a config de novo: no teste de pessoa (celular) uma
// abertura de /login fazia ~550 pedidos a /api/firebase-config (ERR_INSUFFICIENT_RESOURCES).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const api = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'services', 'api.ts'), 'utf8');

test('firebaseConfig vai sem login (sem cabecalhoAuth → initFirebase → firebaseConfig)', () => {
  assert.match(api, /firebaseConfig: \(\) => _fetch<FirebaseClientConfig>\(firebaseConfigUrl\(\), \{ semLogin: true \}\)/);
  assert.match(api, /opts\.semLogin \? \{\} : await cabecalhoAuth\(\)/);
});

test('os outros pedidos continuam levando o token', () => {
  assert.match(api, /async function cabecalhoAuth/);
  assert.equal((api.match(/semLogin: true/g) || []).length, 1);
});
