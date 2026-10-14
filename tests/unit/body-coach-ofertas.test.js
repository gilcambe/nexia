'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const ofertas = require('../../netlify/functions/body-coach/ofertas.js');

const of = (id, categoria, extra = {}) => ({ id, loja: 'Shopee', titulo: `Produto ${id}`, preco: 99.9, preco_antigo: 129.9, desconto: 23.4, imagem: 'https://img/x.jpg', link: `https://s.shopee.com.br/${id}`, categoria, ...extra });

test('ofertas: só as 6 categorias de treino passam', () => {
  const r = ofertas.limparOfertas({ atualizado: '2026-10-14T10:00:00Z', ofertas: [
    of('a', 'suplementos'), of('b', 'casa'), of('c', 'beleza'), of('d', 'bebe'), of('e', 'pet'), of('f', 'eletronicos'),
    of('g', 'fones'), of('h', 'relogios'), of('i', 'em-casa'), of('j', 'roupas'), of('k', 'acessorios'), of('l', undefined),
  ] });
  assert.deepEqual(r.ofertas.map((o) => o.categoria).sort(), ['acessorios', 'em-casa', 'fones', 'relogios', 'roupas', 'suplementos']);
  assert.equal(r.atualizado, '2026-10-14T10:00:00Z');
  assert.equal(r.ofertas[0].desconto, 23);
});

test('ofertas: no máximo 60, intercalando as categorias', () => {
  const lista = [];
  for (const c of ofertas.CATEGORIAS) for (let i = 0; i < 30; i++) lista.push(of(`${c}${i}`, c));
  const r = ofertas.limparOfertas({ ofertas: lista });
  assert.equal(r.ofertas.length, 60);
  for (const c of ofertas.CATEGORIAS) assert.equal(r.ofertas.filter((o) => o.categoria === c).length, 10);
});

test('ofertas: descarta link que não é https', () => {
  const r = ofertas.limparOfertas({ ofertas: [of('a', 'fones', { link: 'javascript:alert(1)' }), of('b', 'fones', { imagem: 'http://x' })] });
  assert.equal(r.ofertas.length, 1);
  assert.equal(r.ofertas[0].imagem, '');
});

test('ofertas: cache de 1 hora e falha devolve lista vazia', async () => {
  ofertas._limparCache();
  let chamadas = 0;
  const buscar = async (url) => { chamadas++; assert.equal(url, ofertas.URL_OFERTAS); return { ok: true, json: async () => ({ ofertas: [of('a', 'fones')] }) }; };
  const t = Date.parse('2026-10-14T12:00:00Z');
  assert.equal((await ofertas.lojaOfertas({ agora: t, buscar })).ofertas.length, 1);
  await ofertas.lojaOfertas({ agora: t + 59 * 60000, buscar });
  assert.equal(chamadas, 1);
  await ofertas.lojaOfertas({ agora: t + 61 * 60000, buscar });
  assert.equal(chamadas, 2);
  ofertas._limparCache();
  assert.deepEqual(await ofertas.lojaOfertas({ agora: t, buscar: async () => { throw new Error('rede'); } }), { ofertas: [] });
  assert.deepEqual(await ofertas.lojaOfertas({ agora: t, buscar: async () => ({ ok: false, status: 404 }) }), { ofertas: [] });
  ofertas._limparCache();
});
