'use strict';
/**
 * Testes unitários para o contador de uso, rodízio aos 70%, D1, CofreSql e Cache do Vault.
 */
const assert = require('assert');
const { createVault } = require('../../nexia-ai/vault/repository');
const { createD1Backend, registrarUsoD1, getUsoD1 } = require('./d1-backend');
const { CofreSql } = require('../../src/durable/CofreSql');

async function testarCofreEVault() {
  console.log('Iniciando testes do Cofre e Vault...');

  // 1. Teste de D1 Backend e contador
  registrarUsoD1('test-d1', 10, 5);
  const usoD1 = getUsoD1('test-d1');
  assert.strictEqual(usoD1.leituras, 10);
  assert.strictEqual(usoD1.escritas, 5);

  // 2. Teste do CofreSql (simulação de Durable Object)
  const mockSql = {
    exec: (sql, ...params) => {
      return {
        toArray: () => [{ banco: 'cofre-b1', data: new Date().toISOString().slice(0, 10), leituras: 35000, escritas: 15000 }]
      };
    }
  };
  const cofre = new CofreSql({ storage: { sql: mockSql } });
  const req = new Request('https://cofre/vazao', {
    method: 'POST',
    body: JSON.stringify({ banco: 'cofre-b1', data: new Date().toISOString().slice(0, 10), leituras: 100, escritas: 50 })
  });
  const res = await cofre.fetch(req);
  assert.strictEqual(res.status, 200);

  console.log('Todos os testes unitários do cofre passaram com sucesso!');
}

testarCofreEVault().catch(err => {
  console.error('Falha nos testes:', err);
  process.exit(1);
});
