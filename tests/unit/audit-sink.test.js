'use strict';
// Auditoria fora do Firestore (arquivo do Actions): autorizada pelo dono em 2026-10-07.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createFileAuditSink } = require('../../nexia-ai/vault/audit-file');

test('AS1. sem NEXIA_AUDIT_FILE não há destino e a auditoria fica no Firestore', () => {
  assert.strictEqual(createFileAuditSink(''), null);
});

test('AS2. o destino grava uma linha JSON por entrada', async () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'aud-')), 'a.jsonl');
  const sink = createFileAuditSink(f);
  await sink.append({ id: 'aud_1', operation: 'create' });
  await sink.append({ id: 'aud_2', operation: 'update' });
  const linhas = fs.readFileSync(f, 'utf8').trim().split('\n').map(JSON.parse);
  assert.deepStrictEqual(linhas.map(l => l.id), ['aud_1', 'aud_2']);
});

test('AS3. com auditSink o Vault não escreve em vault_audit e entrega a entrada ao destino', async () => {
  const { createVault } = require('../../nexia-ai/vault');
  const writes = [];
  const ref = p => ({ path: p });
  const db = {
    collection: c => ({ doc: id => ref(`${c}/${id}`) }),
    runTransaction: async fn => fn({
      get: async r => ({ exists: r.path.startsWith('tenants/'), data: () => ({}), id: r.path }),
      create: (r) => writes.push(r.path), set: (r) => writes.push(r.path), update: (r) => writes.push(r.path), delete: () => {},
    }),
  };
  const got = [];
  const vault = createVault({ db, FieldValue: { serverTimestamp: () => 'ts' }, auditSink: { append: async e => got.push(e) } });
  const { createExecutionContext } = require('../../nexia-ai/vault');
  const ctx = createExecutionContext({ tenantId: 't1', actor: { type: 'user', id: 'u' } });
  try { await vault.Client.create(ctx, { name: 'X', slug: 'x-clientes', status: 'active' }); } catch (e) { if (process.env.DBG) console.log(e.code, JSON.stringify(e.details || e.message)); }
  assert.ok(!writes.some(w => w.startsWith('vault_audit/')), 'nada em vault_audit');
  assert.ok(got.length === 1 && got[0].operation === 'create' && got[0].entity === 'Client');
});
