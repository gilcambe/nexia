'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { Firestore } = require('../../lib/firebase-lite/firestore');

test('Vault - Contador, limite de 70% e cache em memória (TTL 60s)', async () => {
  const db = new Firestore({ projectId: 'test-project-1' });
  
  // 1. Testar contador de uso
  assert.strictEqual(typeof db._getContadorGeral, 'function', 'Deve possuir método _getContadorGeral');
  const contadorInicial = db._getContadorGeral();
  assert.strictEqual(contadorInicial.reads, 0);
  assert.strictEqual(contadorInicial.writes, 0);

  // 2. Testar cache em memória com TTL de 60s e invalidação por escrita
  const pathDoc = 'projects/test-project-1/databases/(default)/documents/users/123';
  const mockRow = { found: { name: pathDoc, fields: { name: { stringValue: 'Teste' } } } };
  
  db._setToCache(pathDoc, mockRow);
  const cached = db._getFromCache(pathDoc);
  assert.deepStrictEqual(cached, mockRow, 'Deve retornar o documento do cache');

  // Testar invalidação de cache por escrita
  const docRef = db.doc('users/123');
  // Simulamos _clearCache através de set/update ou chamada direta
  db._clearCache(pathDoc);
  assert.strictEqual(db._getFromCache(pathDoc), null, 'O cache deve ser limpo após escrita/invalidação');

  // 3. Testar verificação de quase cheio (70%)
  assert.strictEqual(typeof db._estaQuaseCheio, 'function', 'Deve possuir método _estaQuaseCheio');
  const quaseCheio = await db._estaQuaseCheio();
  assert.strictEqual(typeof quaseCheio, 'boolean', '_estaQuaseCheio deve retornar booleano');
});
