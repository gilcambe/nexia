'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../../sites/bezsan/leiloes/fontes.js');

test('LF1 fontes: portais com nome, https, tipo válido e dica', () => {
  assert.ok(Array.isArray(F.PORTAIS) && F.PORTAIS.length >= 12);
  for (const p of F.PORTAIS) {
    assert.ok(p.nome && p.dica, p.nome);
    assert.ok(p.url.startsWith('https://'), p.url);
    assert.ok(['banco', 'leiloeiro', 'tribunal'].includes(p.tipo), p.tipo);
  }
  assert.equal(F.PORTAIS[0].url, 'https://venda-imoveis.caixa.gov.br/sistema/busca-imovel.asp');
});

test('LF2 fontes: lista da Caixa por estado', () => {
  assert.equal(F.listaCaixa('sp'), 'https://venda-imoveis.caixa.gov.br/listaweb/Lista_imoveis_SP.csv');
  assert.equal(F.listaCaixa(' RJ '), 'https://venda-imoveis.caixa.gov.br/listaweb/Lista_imoveis_RJ.csv');
  assert.equal(F.listaCaixa('XX'), null);
  assert.equal(F.listaCaixa(''), null);
});

test('LF3 fontes: 27 estados em ordem alfabética', () => {
  assert.equal(F.UFS.length, 27);
  assert.deepEqual([...F.UFS].sort(), F.UFS);
});

test('LF4 fontes: IPTU das capitais conhecidas e busca para as outras', () => {
  const sp = F.consultaIptu('são paulo', 'sp');
  assert.equal(sp.url, 'https://www.prefeitura.sp.gov.br/cidade/secretarias/fazenda/servicos/iptu/');
  assert.equal(sp.passos.length, 4);
  assert.equal(F.consultaIptu('Rio de Janeiro', 'RJ').url, 'https://carioca.rio/servicos/certidao-de-situacao-fiscal-e-enfiteutica-do-imovel/');
  assert.equal(F.consultaIptu('Belo Horizonte', 'MG').url, 'https://prefeitura.pbh.gov.br/fazenda/iptu');
  const outra = F.consultaIptu('Ribeirão Preto', 'SP');
  assert.ok(outra.url.startsWith('https://www.google.com/search?q='));
  assert.ok(outra.url.includes(encodeURIComponent('Ribeirão Preto')));
  assert.ok(outra.passos.length >= 3);
});
