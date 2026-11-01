'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { Firestore } = require('./lib/firebase-lite/firestore.js');

test('Firestore Vault ops counter and memory cache tests', async (t) => {
  const db = new Firestore({ projectId: 'test-project' });
  
  await t.test('contador de uso inicializa zerado', () => {
    const stats = db.getUsageStats();
    assert.strictEqual(typeof stats.reads, 'number');
    assert.strictEqual(typeof stats.writes, 'number');
    assert.strictEqual(stats.reads, 0);
    assert.strictEqual(stats.writes, 0);
  });

  await t.test('cache em memória e invalidação em escrita', async () => {
    const docRef = db.collection('test_vault').doc('doc1');
    
    // Simula cache interno
    db._vaultCache = db._vaultCache || new Map();
    db._vaultCache.set(docRef.path, { data: { name: 'cached' }, time: Date.now() });

    const cachedItem = db._vaultCache.get(docRef.path);
    assert.strictEqual(cachedItem.data.name, 'cached');

    // Ao fazer set/update deve limpar o cache do path
    await docRef.set({ name: 'updated' });
    assert.strictEqual(db._vaultCache.has(docRef.path), false);
  });
});
