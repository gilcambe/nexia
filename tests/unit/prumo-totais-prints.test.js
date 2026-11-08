'use strict';
// Caso real (valores trocados para não expor a carteira de ninguém): renda fixa com título de grupo
// "CDB (92,77%)" + 1 CDB, e renda variável rolada em 7 prints, com o total só no primeiro e ativos repetidos.
const test = require('node:test');
const assert = require('node:assert/strict');
const { tirarSubtotais, LER_PRINT } = require('../../netlify/functions/prumo.js');
const { conferirTotais } = require('../../prumo/carteira.js');

test('TP1. título de grupo com subtotal não é somado como item', () => {
  const rf = tirarSubtotais([{ nome: 'CDB (92,77%)', valor: 1000 }, { nome: 'CDB LIQUIDEZ DIARIA', valor: 1000 }]);
  assert.deepEqual(rf.map((x) => x.nome), ['CDB LIQUIDEZ DIARIA']);
  const fiis = tirarSubtotais([{ nome: 'FIIs', valor: 300 }, { nome: 'MXRF11', ticker: 'MXRF11', quantidade: 10, valor: 100 }, { nome: 'HGLG11', ticker: 'HGLG11', quantidade: 1, valor: 200 }]);
  assert.equal(fiis.length, 2);
  // "CDB" que é um investimento de verdade (valor não é soma de nada abaixo) fica.
  const real = tirarSubtotais([{ nome: 'CDB', valor: 500 }, { nome: 'Poupança', valor: 80 }]);
  assert.equal(real.length, 2);
  assert.match(LER_PRINT, /Título de grupo com subtotal NÃO é item/);
});

test('TP2. vários prints rolados da mesma tela somam contra o total do primeiro', () => {
  const itens = [
    { nome: 'CDB LIQUIDEZ DIARIA', valor: 1000 },               // print 1 (renda fixa, total 1000)
    { ticker: 'AAAA11', valor: 300 }, { ticker: 'BBBB11', valor: 200 }, // print 2 (renda variável, total 1000)
    { ticker: 'CCCC11', valor: 150 }, { ticker: 'DDDD11', valor: 100 }, // print 3
    { ticker: 'DDDD11', valor: 100 }, { ticker: 'EEEE11', valor: 250 }, // print 4 (DDDD11 repetido do anterior)
  ];
  const dup = itens.map((x, i) => i === 5);
  const conf2 = [{ total_print: 1000, itens: 1 }, { total_print: 1000.5, itens: 2 }, { total_print: null, itens: 2 }, { total_print: 1000.5, itens: 2 }];
  const itens2 = itens.map((x, i) => (i === 6 ? { ...x, valor: 250.5 } : x));
  const r2 = conferirTotais(conf2, itens2, dup);
  assert.equal(r2.length, 2);
  assert.ok(r2.every((c) => c.confere), JSON.stringify(r2));
  assert.equal(r2[1].soma_itens, 1000.5);
});

test('TP3. quando falta print, avisa quanto falta', () => {
  const r = conferirTotais([{ total_print: 500, itens: 1 }], [{ ticker: 'AAAA11', valor: 300 }], [false]);
  assert.equal(r[0].confere, false);
  assert.equal(r[0].soma_itens, 300);
});
