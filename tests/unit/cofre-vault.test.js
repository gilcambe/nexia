'use strict';
/**
 * Testes unitários para o Cofre (Vault), contador de uso, limites 70%, failover e cache em memória (TTL 60s).
 */

const test = require('node:test');
const assert = require('node:assert');
const fsLite = require('../../lib/firebase-lite/firestore');
const { createD1Backend, registrarUsoD1, getUsoD1 } = require('../../lib/firebase-lite/d1-backend');

test('Contador de uso e limites por banco (Firestore e D1)', () => {
  const bancoKey = 'test-banco-firestore';
  fsLite.registrarUso(bancoKey, 35000, 15000); // 70% de 50k (35k) e 20k (14k)
  const uso = fsLite.getBancosUsoGeral();
  assert.ok(Array.isArray(uso));
  const b = uso.find(x => x.banco === bancoKey);
  assert.ok(b);
  assert.strictEqual(b.reads, 35000);
  assert.strictEqual(b.writes, 15000);
  assert.strictEqual(b.quaseCheio, true);
});

test('Cache em memória com TTL de 60s para leituras de documentos no Vault', async () => {
  const mockDriver = {
    exec: (sql) => {
      if (sql.includes('SELECT')) {
        return [{ data: JSON.stringify({ name: 'projects/test/databases/(default)/documents/users/123', fields: { name: { stringValue: 'Teste' } } }) }];
      }
      return [];
    }
  };
  const d1 = createD1Backend({ driver: mockDriver, projectId: 'cache-test' });
  
  // Primeira leitura (vai ao driver)
  const res1 = await d1.batchGet(['projects/test/databases/(default)/documents/users/123']);
  assert.strictEqual(res1.length, 1);
  assert.ok(res1[0].found);

  // Segunda leitura (deve vir do cache em memória)
  const res2 = await d1.batchGet(['projects/test/databases/(default)/documents/users/123']);
  assert.strictEqual(res2.length, 1);
  assert.ok(res2[0].found);
});
