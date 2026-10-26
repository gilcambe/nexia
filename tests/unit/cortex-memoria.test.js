import test from 'node:test';
import assert from 'node:assert';
import { db } from '../src/db.ts';
import { Memory } from '../src/models/Memory.ts';

test('cortex_memoria ORM insert and read', () => {
  const memoryRecord: Memory = {
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
