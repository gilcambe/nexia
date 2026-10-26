import test from 'node:test';
import assert from 'node:assert';
import { db } from '../../src/db.ts';

// Testes antigos mantidos para cobertura
test('C6a - Verificação básica do módulo DB', () => {
  assert.ok(db);
});

test('C6b - Método runMigration existe', () => {
  assert.strictEqual(typeof db.runMigration, 'function');
});

test('C6c - Método insert e findById existem', () => {
  assert.strictEqual(typeof db.insert, 'function');
  assert.strictEqual(typeof db.findById, 'function');
});

// Novo teste obrigatório: insere e lê um registro da tabela cortex_memoria com sucesso
test('cortex_memoria ORM insert and read', () => {
  const memoryRecord = {
    uid: 'user-123',
    id: 'mem-001',
    texto: 'Teste de memória do Cortex',
    tipo: 'fato',
    criado_em: new Date().toISOString(),
    usado_em: new Date().toISOString()
  };

  db.insert('cortex_memoria', memoryRecord);
  const fetched = db.findById('cortex_memoria', 'mem-001');

  assert.notStrictEqual(fetched, null);
  assert.strictEqual(fetched?.id, 'mem-001');
  assert.strictEqual(fetched?.uid, 'user-123');
  assert.strictEqual(fetched?.texto, 'Teste de memória do Cortex');
  assert.strictEqual(fetched?.tipo, 'fato');
});
