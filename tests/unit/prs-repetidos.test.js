'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { decidir } = require('../../scripts/prs-repetidos.js');

test('PRs repetidos: 6 PRs da #2248 → fecha 5, mantém o verde mais novo', () => {
  const agora = Date.now();
  const prs = [
    {
      number: 2502,
      head: { ref: 'nexia/test-1' },
      title: 'Reserva: issue #2248',
      body: 'Implementação da feature X',
      state: 'open',
      labels: [],
      status: { state: 'failure' },
      updated_at: new Date(agora - 48 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(agora - 60 * 60 * 1000).toISOString()
    },
    {
      number: 2510,
      head: { ref: 'nexia/test-2' },
      title: 'Reserva: issue #2248',
      body: 'Implementação da feature X',
      state: 'open',
      labels: [],
      status: { state: 'failure' },
      updated_at: new Date(agora - 36 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(agora - 48 * 60 * 60 * 1000).toISOString()
    },
    {
      number: 2552,
      head: { ref: 'nexia/test-3' },
      title: 'Reserva: issue #2248',
      body: 'Implementação da feature X',
      state: 'open',
      labels: [],
      status: { state: 'failure' },
      updated_at: new Date(agora - 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(agora - 36 * 60 * 60 * 1000).toISOString()
    },
    {
      number: 2556,
      head: { ref: 'nexia/test-4' },
      title: 'Reserva: issue #2248',
      body: 'Implementação da feature X',
      state: 'open',
      labels: [],
      status: { state: 'failure' },
      updated_at: new Date(agora - 12 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(agora - 24 * 60 * 60 * 1000).toISOString()
    },
    {
      number: 2558,
      head: { ref: 'nexia/test-5' },
      title: 'Reserva: issue #2248',
      body: 'Implementação da feature X',
      state: 'open',
      labels: [],
      status: { state: 'failure' },
      updated_at: new Date(agora - 6 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(agora - 12 * 60 * 60 * 1000).toISOString()
    },
    {
      number: 2561,
      head: { ref: 'nexia/test-6' },
      title: 'Reserva: issue #2248',
      body: 'Implementação da feature X',
      state: 'open',
      labels: [],
      status: { state: 'success' },
      updated_at: new Date(agora - 2 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(agora - 6 * 60 * 60 * 1000).toISOString()
    }
  ];
  
  const resultado = decidir(prs, agora);
  
  // Deve manter o PR com CI verde (2561)
  assert.strictEqual(resultado.manter.length, 1);
  assert.strictEqual(resultado.manter[0], 2561);
  
  // Deve fechar os outros 5 PRs
  assert.strictEqual(resultado.fechar.length, 5);
  assert.strictEqual(resultado.totalFechar, 5);
  assert.strictEqual(resultado.totalManter, 1);
  
  // Verifica se os fechamentos estão corretos
  const fechados = resultado.fechar.map(f => f.number).sort();
  assert.deepStrictEqual(fechados, [2502, 2510, 2552, 2556, 2558]);
  
  // Verifica se os motivos estão corretos
  resultado.fechar.forEach(f => {
    assert.strictEqual(f.motivo, 'repetido de #2248');
  });
});

test('PRs repetidos: mantém PRs com rótulos especiais', () => {
  const agora = Date.now();
  const prs = [
    {
      number: 2502,
      head: { ref: 'nexia/test-1' },
      title: 'Reserva: issue #2248',
      body: 'Implementação da feature X',
      state: 'open',
      labels: [{ name: 'dono-aprovou' }],
      status: { state: 'failure' },
      updated_at: new Date(agora - 48 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(agora - 60 * 60 * 1000).toISOString()
    },
    {
      number: 2510,
      head: { ref: 'nexia/test-2' },
      title: 'Reserva: issue #2248',
      body: 'Implementação da feature X',
      state: 'open',
      labels: [],
      status: { state: 'failure' },
      updated_at: new Date(agora - 36 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(agora - 48 * 60 * 60 * 1000).toISOString()
    }
  ];
  
  const resultado = decidir(prs, agora);
  
  // Deve manter ambos os PRs (um tem rótulo especial)
  assert.strictEqual(resultado.manter.length, 2);
  assert.strictEqual(resultado.fechar.length, 0);
});

test('PRs repetidos: PRs fora da branch nexia/ não são fechados', () => {
  const agora = Date.now();
  const prs = [
    {
      number: 2502,
      head: { ref: 'feature/test-1' },
      title: 'Reserva: issue #2248',
      body: 'Implementação da feature X',
      state: 'open',
      labels: [],
      status: { state: 'failure' },
      updated_at: new Date(agora - 48 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(agora - 60 * 60 * 1000).toISOString()
    },
    {
      number: 2510,
      head: { ref: 'nexia/test-2' },
      title: 'Reserva: issue #2248',
      body: 'Implementação da feature X',
      state: 'open',
      labels: [],
      status: { state: 'failure' },
      updated_at: new Date(agora - 36 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(agora - 48 * 60 * 60 * 1000).toISOString()
    }
  ];
  
  const resultado = decidir(prs, agora);
  
  // Deve manter ambos os PRs (um não é da branch nexia/)
  assert.strictEqual(resultado.manter.length, 2);
  assert.strictEqual(resultado.fechar.length, 0);
});

test('PRs repetidos: limite de 15 fechamentos por rodada', () => {
  const agora = Date.now();
  const prs = [];
  
  // Criar 20 PRs repetidos
  for (let i = 1; i <= 20; i++) {
    prs.push({
      number: 2500 + i,
      head: { ref: `nexia/test-${i}` },
      title: `Reserva: issue #2248`,
      body: 'Implementação da feature X',
      state: 'open',
      labels: [],
      status: i === 20 ? { state: 'success' } : { state: 'failure' },
      updated_at: new Date(agora - i * 60 * 60 * 1000).toISOString(),
      created_at: new Date(agora - i * 60 * 60 * 1000).toISOString()
    });
  }
  
  const resultado = decidir(prs, agora);
  
  // Deve manter apenas o PR com CI verde (último)
  assert.strictEqual(resultado.manter.length, 1);
  assert.strictEqual(resultado.manter[0], 2520);
  
  // Deve fechar apenas 15 PRs (limite)
  assert.strictEqual(resultado.fechar.length, 15);
  assert.strictEqual(resultado.totalFechar, 19);
});

test('PRs repetidos: PRs com CI vermelho há mais de 48h cuja issue já está fechada', () => {
  const agora = Date.now();
  const prs = [
    {
      number: 2362,
      head: { ref: 'nexia/sentinel-1' },
      title: 'Sentinel: issue #123',
      body: 'Implementação do sentinel',
      state: 'open',
      labels: [],
      status: { state: 'failure' },
      updated_at: new Date(agora - 72 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(agora - 72 * 60 * 60 * 1000).toISOString()
    },
    {
      number: 2545,
      head: { ref: 'nexia/sentinel-2' },
      title: 'Sentinel: issue #123',
      body: 'Implementação do sentinel',
      state: 'open',
      labels: [],
      status: { state: 'failure' },
      updated_at: new Date(agora - 60 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(agora - 60 * 60 * 60 * 1000).toISOString()
    },
    {
      number: 2573,
      head: { ref: 'nexia/sentinel-3' },
      title: 'Sentinel: issue #123',
      body: 'Implementação do sentinel',
      state: 'open',
      labels: [],
      status: { state: 'failure' },
      updated_at: new Date(agora - 48 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(agora - 48 * 60 * 60 * 1000).toISOString()
    }
  ];
  
  // Simula que a issue #123 já está fechada
  const issuesFechadas = [{ number: 123, state: 'closed' }];
  
  const resultado = decidir(prs, agora, issuesFechadas);
  
  // Deve fechar apenas os PRs com CI vermelho há mais de 48h (2362 e 2545)
  assert.strictEqual(resultado.fechar.length, 2);
  assert.strictEqual(resultado.totalFechar, 2);
  
  // O PR 2573 não deve ser fechado (menos de 48h)
  assert.ok(!resultado.fechar.some(f => f.number === 2573));
});
