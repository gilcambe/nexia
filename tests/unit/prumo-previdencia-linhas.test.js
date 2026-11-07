// Caso real 07/11/2026: print da MetLife/Multiprev com o mesmo plano em duas linhas
// (Participante 74.749,03 e Patrocinadora 37.760,81, TOTAL 112.509,84). O app só contou a primeira.
const test = require('node:test');
const assert = require('node:assert');
const p = require('../../netlify/functions/prumo.js');

const plano = 'PLANO DE BENEFÍCIOS AVAYA';

test('conta Participante/Patrocinadora entra no nome e as duas linhas ficam separadas', () => {
  const a = p.normalizarLido({ nome: plano, banco: 'Multiprev', tipo: 'previdencia', conta: 'Participante', valor: '74.749,03' });
  const b = p.normalizarLido({ nome: plano, banco: 'Multiprev', tipo: 'previdencia', conta: 'Patrocinadora', valor: '37.760,81' });
  assert.notStrictEqual(a.nome, b.nome);
  assert.match(a.nome, /Participante/);
  assert.match(b.nome, /Patrocinadora/);
  assert.strictEqual(Math.round((a.valor + b.valor) * 100), 11250984);
});

test('sem "conta", mesmo nome com valor diferente vira "linha 2" (não some como repetido)', () => {
  const l = p.separarLinhasIguais([
    { nome: plano, banco: 'Multiprev', valor: 74749.03 },
    { nome: plano, banco: 'Multiprev', valor: 37760.81 },
  ]);
  assert.strictEqual(l[0].nome, plano);
  assert.strictEqual(l[1].nome, `${plano} (linha 2)`);
});

test('mesma linha com o mesmo valor continua sendo repetida', () => {
  const l = p.separarLinhasIguais([
    { nome: plano, banco: 'Multiprev', valor: 74749.03 },
    { nome: plano, banco: 'Multiprev', valor: 74749.03 },
  ]);
  assert.strictEqual(l[1].nome, plano);
});

test('o prompt manda ler todas as linhas do mesmo plano', () => {
  assert.match(p.LER_PRINT, /Patrocinadora/);
  assert.match(p.LER_PRINT, /"conta"/);
});
