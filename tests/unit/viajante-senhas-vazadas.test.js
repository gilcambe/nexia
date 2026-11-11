'use strict';
// Segurança (11/11/2026): senhas iniciais vazaram em comentário público.
// 1) Conta cuja senha gravada no banco é uma das vazadas não entra mais (403), mesmo acertando a senha.
// 2) Conta nova sem senha inicial no cadastro NÃO recebe senha padrão do código.
const test = require('node:test');
const assert = require('node:assert/strict');
const { handler, SENHAS_VAZADAS } = require('../../netlify/functions/viajante-pro');
const { VIAJANTE_PRO } = require('../../clientes/viajantepro');

function mockConta(docData) {
  let gravado = null;
  globalThis.__NEXIA_FIRESTORE_MOCK__ = {
    collection: () => ({ doc: () => ({
      get: async () => ({ exists: !!(docData || gravado), data: () => docData || gravado }),
      set: async v => { gravado = v; },
      collection: () => ({ doc: () => ({ set: async () => {} }) }),
    }) }),
  };
  return () => gravado;
}
const entrar = senha => handler({ httpMethod: 'POST', queryStringParameters: { site: 'viajantepro' }, body: JSON.stringify({ acao: 'entrar', senha }) }, {});

test('SEG1. senha vazada gravada no banco é recusada com 403', async () => {
  const vazado = [...SENHAS_VAZADAS][0];
  mockConta({ nome: 'Conta antiga', senha_hash: vazado, senha_salt: 'd3451e7f34a8549290d4cda5b069c80b' });
  const r = await entrar('qualquer-tentativa');
  assert.equal(r.statusCode, 403);
  assert.equal(JSON.parse(r.body).senha_desativada, true);
});

test('SEG2. conta nova sem senha inicial não ganha senha padrão e não entra', async () => {
  const antes = VIAJANTE_PRO.viajantepro.senhas_iniciais;
  delete VIAJANTE_PRO.viajantepro.senhas_iniciais;
  const lido = mockConta(null);
  const r = await entrar('qualquer');
  assert.equal(lido().senha_hash, null, 'não pode existir senha padrão');
  assert.equal(r.statusCode, 403);
  if (antes) VIAJANTE_PRO.viajantepro.senhas_iniciais = antes;
});

test('SEG3. cadastros não trazem mais senhas iniciais reais', () => {
  for (const f of ['locacoes', 'viagens', 'viajantepro']) {
    const o = Object.values(require('../../clientes/' + f + '.js'))[0];
    for (const [k, c] of Object.entries(o)) assert.ok(!c.senhas_iniciais, f + '/' + k + ' ainda tem senhas_iniciais');
  }
});
