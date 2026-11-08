'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { createHandler } = require('../../netlify/functions/prumo-backup.js');

const dbFalso = () => ({ collection: () => ({ doc: () => ({ get: async () => ({ exists: false }), collection: () => ({ get: async () => ({ docs: [] }) }) }), get: async () => ({ docs: [{ id: 'outro123' }] }) }) });
const chamar = (role, body, headers = {}) => createHandler({ getDb: dbFalso, getMw: () => ({ verifyBearerToken: async () => ({ ok: true, uid: 'eu123456', role }) }) })({ httpMethod: 'POST', headers: { authorization: 'Bearer x', ...headers }, body: JSON.stringify(body) });

test('PBK1. nem o master exporta, apaga ou restaura dados de outra pessoa', async () => {
  for (const acao of ['export', 'apagar', 'restaurar']) {
    const r = await chamar('master', { acao, uid: 'outro123', confirmacao: 'EXCLUIR_DADOS_DEFINITIVAMENTE', backup: {} });
    assert.strictEqual(r.statusCode, 403, acao);
  }
});

test('PBK2. cabeçalho de cron não abre a porta sem login', async () => {
  const r = await createHandler({ getDb: dbFalso })({ httpMethod: 'POST', headers: { 'x-nexia-cron': '1' }, body: '{}' });
  assert.strictEqual(r.statusCode, 401);
});

test('PBK3. backup geral do master só devolve contagens, sem identificar ninguém', async () => {
  const r = await chamar('master', { acao: 'backup_diario' });
  assert.strictEqual(r.statusCode, 200);
  assert.doesNotMatch(r.body, /outro123/);
  const n = await chamar('user', { acao: 'backup_diario' });
  assert.strictEqual(n.statusCode, 403);
});
