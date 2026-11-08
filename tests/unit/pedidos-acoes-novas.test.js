'use strict';
// #3135 / #3222: outra-ia, resolvida, lote e "assumiu".
const test = require('node:test');
const assert = require('node:assert/strict');
const { agir } = require('../../netlify/functions/central/pedidos-acoes');

function fake(labels = {}) {
  const chamadas = [];
  const gh = async (c, init = {}) => {
    chamadas.push([init.method || 'GET', c, init.body || '']);
    const m = /issues\/(\d+)$/.exec(c);
    if (m && !init.method) {
      if (m[1] === '99') throw new Error('não existe');
      return { number: Number(m[1]), labels: (labels[m[1]] || []).map((name) => ({ name })) };
    }
    return {};
  };
  return { p: { gh }, chamadas };
}

test('AN1. outra-ia: Cortex vai para as IAs grátis', async () => {
  const { p, chamadas } = fake({ 5: ['cortex-travado', 'pista-2'] });
  const x = await agir(p, { acao: 'outra-ia', n: 5 }, 'dono');
  assert.equal(x.corpo.ia, 'IAs grátis');
  assert.ok(chamadas.some(([m, c]) => m === 'DELETE' && c.endsWith('cortex-travado')));
  assert.ok(chamadas.some(([m, c]) => m === 'POST' && c.includes('cortex-reserva.yml/dispatches')));
  assert.equal(x.corpo.assumiu[0].ia, 'IAs grátis');
});

test('AN2. outra-ia: Jules volta para o Cortex', async () => {
  const { p, chamadas } = fake({ 6: ['jules-enviado', 'tentativa-11'] });
  const x = await agir(p, { acao: 'outra-ia', n: 6 }, 'dono');
  assert.equal(x.corpo.ia, 'Cortex');
  assert.ok(chamadas.some(([m, c]) => m === 'DELETE' && c.endsWith('jules-enviado')));
  assert.ok(chamadas.some(([m, c]) => m === 'DELETE' && c.endsWith('tentativa-11')));
});

test('AN3. resolvida fecha com cortex-feito', async () => {
  const { p, chamadas } = fake();
  const x = await agir(p, { acao: 'resolvida', n: 7 }, 'dono');
  assert.equal(x.status, 200);
  assert.ok(chamadas.some(([m, , b]) => m === 'POST' && b.includes('cortex-feito')));
  assert.ok(chamadas.some(([m, , b]) => m === 'PATCH' && b.includes('closed')));
});

test('AN4. lote: um feito e um com erro', async () => {
  const { p } = fake({ 8: ['cortex-travado'] });
  const x = await agir(p, { acao: 'lote', tipo: 'tentar', ns: [8, 99] }, 'dono');
  assert.deepEqual(x.corpo.feitos, [8]);
  assert.equal(x.corpo.erros[0].n, 99);
});
