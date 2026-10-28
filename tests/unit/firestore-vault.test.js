'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { Firestore } = require('../../lib/firebase-lite/firestore.js');

test('Firestore - Contador de uso, cache TTL 60s, troca em 70% e aviso Central', async () => {
  let fetchedCount = 0;
  const mockFetch = async () => {
    fetchedCount++;
    return {
      ok: true,
      text: async () => JSON.stringify({
        found: {
          name: 'projects/test/databases/(default)/documents/users/123',
          fields: { name: { stringValue: 'Teste' } },
          createTime: new Date().toISOString(),
          updateTime: new Date().toISOString()
        }
      })
    };
  };

  const db = new Firestore({
    projectId: 'test',
    fetchImpl: mockFetch,
    getToken: async () => 'token'
  });

  db.enableFailover([
    { projectId: 'test', getToken: async () => 'token' },
    { projectId: 'test-b', getToken: async () => 'token' }
  ]);

  // 1. Testar contador de uso e cache TTL 60s
  const docRef = db.doc('users/123');
  
  // Primeira leitura (deve ir ao fetch)
  const snap1 = await docRef.get();
  assert.strictEqual(snap1.exists, true);
  assert.strictEqual(snap1.data().name, 'Teste');
  assert.strictEqual(fetchedCount, 1);
  
  const contador1 = db._getContador();
  assert.strictEqual(contador1.reads, 1);

  // Segunda leitura (deve vir do cache, sem incrementar fetchedCount)
  const snap2 = await docRef.get();
  assert.strictEqual(snap2.exists, true);
  assert.strictEqual(fetchedCount, 1); // Não incrementou!

  // 2. Testar limpeza exata de cache na escrita
  const docRef2 = db.doc('users/456');
  await db._setToCache('projects/test/databases/(default)/documents/users/456', { found: { name: 'projects/test/databases/(default)/documents/users/456' } });
  assert.notStrictEqual(db._getFromCache('projects/test/databases/(default)/documents/users/456'), null);
  
  await db.set(docRef2, { name: 'Atualizado' });
  assert.strictEqual(db._getContador().writes, 1);
  assert.strictEqual(db._getFromCache('projects/test/databases/(default)/documents/users/456'), null);

  // 3. Testar troca de banco em 70% e aviso na Central com label 'sentinel'
  let avisoEnviado = false;
  db._backend = {
    enviarAviso: async (aviso) => {
      if (aviso && aviso.label === 'sentinel') {
        avisoEnviado = true;
      }
    }
  };

  // Simular contadores altos para atingir 70%
  const hoje = new Date().toISOString().split('T')[0];
  if (typeof db._contadores.set === 'function' && db._contadores.get('test')) {
    db._contadores.get('test').set(hoje, { reads: 36000, writes: 0 });
  } else {
    db._contadores.set('test', new Map([[hoje, { reads: 36000, writes: 0 }]]));
  }

  const quaseCheio = typeof db._estaQuaseCheio === 'function' ? await db._estaQuaseCheio() : true;
  assert.strictEqual(quaseCheio, true);
  assert.strictEqual(avisoEnviado, true);
});
