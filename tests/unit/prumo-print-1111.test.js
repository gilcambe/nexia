'use strict';
// #3532 — caso real do dono (prints do banco de 11/11/2026). Teste permanente: nunca pode voltar.
// A IA falsa devolve os MESMOS erros que apareceram no app (valor 10x, banco inventado, data inventada,
// FII como renda fixa, ETF como FII). O resultado final tem que bater com o print: R$ 149.031,74.
const test = require('node:test');
const assert = require('node:assert/strict');
const p = require('../../netlify/functions/prumo.js');
const { chaveAtivo } = require('../../prumo/carteira.js');

// [ticker, valor certo, qtd, preço médio, cotação, tipo certo]
const RV = [
  ['MXRF11', 3212.90, 361, 9.23, 8.90, 'fiis'], ['BTLG11', 2551.12, 26, 100.82, 98.12, 'fiis'],
  ['RBRR11', 1197.00, 19, 76.22, 63.00, 'fiis'], ['HGLG11', 1167.76, 8, 147.99, 145.97, 'fiis'],
  ['KNRI11', 441.00, 3, 156.26, 147.00, 'fiis'], ['GARE11', 301.92, 37, 8.40, 8.16, 'fiis'],
  ['VGIR11', 274.35, 31, 9.60, 8.85, 'fiis'], ['XPML11', 273.87, 3, 100.27, 91.29, 'fiis'],
  ['CDII11', 267.36, 3, 95.18, 89.12, 'fiis'], ['BTHF11', 196.56, 24, 8.57, 8.19, 'fiis'],
  ['CYCR11', 188.37, 23, 8.48, 8.19, 'fiis'], ['TRXF11', 114.02, 2, 71.98, 57.01, 'fiis'],
  ['KNCR11', 103.59, 1, 106.07, 103.59, 'fiis'], ['IVVB11', 478.80, 1, 428.74, 478.80, 'etf'],
];
// Erros vistos no app do dono (12/11/2026).
const ERRADO = { CYCR11: 1883.70, BTHF11: 1951.20, CDII11: 856.62, XPML11: 902.43, BTLG11: 2518.00, MXRF11: 3232.03, GARE11: 300.96 };
const BANCO_INVENTADO = { BTLG11: 'BTG', XPML11: 'XP', HGLG11: 'XP', CDII11: 'XP', GARE11: 'XP', IVVB11: 'Nubank' };

const printRF = { total_print: 138263.12, data_print: '11/11/2026', itens: [
  { nome: 'CDB (92,77%)', tipo: 'renda_fixa', valor: 138263.12 },
  { nome: 'CDB LIQUIDEZ DIARIA', banco: 'Inter', banco_escrito: false, tipo: 'renda_fixa', valor: 'R$ 138.263,12', data_valor: '2024-02-26' },
] };
const printRV = { total_print: '10.768,62', data_print: '2026-11-11', itens: RV.map(([tk, v, q, pm, c, tipo]) => ({
  nome: tk, ticker: tk, quantidade: q, preco_medio: pm, cotacao: c, valor: ERRADO[tk] ?? v,
  banco: BANCO_INVENTADO[tk] || '', banco_escrito: false, data_valor: '2024-02-26',
  tipo: tk === 'BTLG11' || tk === 'CYCR11' ? 'renda_fixa' : tipo === 'etf' ? 'fiis' : tipo,
})) };

function depsFalsos(respostas) {
  let n = 0;
  return {
    listFor: () => [],
    ai: null,
    getRouter: () => ({ capabilities: () => ({ available: true, vision: true }), chat: async () => ({ text: JSON.stringify(respostas[n++ % respostas.length]) }) }),
  };
}
function bancoFalso() {
  const dados = new Map();
  const col = (caminho) => ({
    doc: (id) => ({
      collection: (nm) => col(`${caminho}/${id}/${nm}`),
      set: async (v) => { dados.set(`${caminho}/${id}`, v); },
      delete: async () => { dados.delete(`${caminho}/${id}`); },
      get: async () => { const v = dados.get(`${caminho}/${id}`); return { exists: !!v, data: () => v }; },
    }),
    get: async () => ({ docs: [...dados.entries()].filter(([k]) => k.startsWith(caminho + '/') && !k.slice(caminho.length + 1).includes('/')).map(([k, v]) => ({ id: k.split('/').pop(), data: () => v })) }),
  });
  return { collection: col };
}
const cent = (x) => Math.round(x * 100) / 100;

async function lerOsDoisPrints() {
  // Um print por chamada: a 1ª imagem recebe o print de renda fixa, a 2ª o de renda variável.
  const r1 = await p.lerPrint([{ mime: 'image/png', data: 'AAAA' }], depsFalsos([printRF]));
  const r2 = await p.lerPrint([{ mime: 'image/png', data: 'AAAA' }], depsFalsos([printRV]));
  return { itens: [...r1.itens, ...r2.itens], conferencia: [...r1.conferencia, ...r2.conferencia] };
}

test('KF-1111a leitura corrige valor 10x, tira banco e data inventados, tipo certo', async () => {
  const { itens, conferencia } = await lerOsDoisPrints();
  assert.equal(itens.length, 15, 'CDB + 14 papéis (o subtotal "CDB (92,77%)" não é item)');
  const cdb = itens.find((i) => /LIQUIDEZ/.test(i.nome));
  assert.equal(cdb.valor, 138263.12); assert.equal(cdb.tipo, 'renda_fixa');
  for (const [tk, v, q, , , tipo] of RV) {
    const it = itens.find((i) => i.ticker === tk);
    assert.ok(it, tk);
    assert.equal(it.valor, v, `${tk} valor`);
    assert.equal(it.quantidade, q, `${tk} qtd`);
    assert.equal(it.tipo, tipo, `${tk} tipo`);
  }
  for (const i of itens) {
    assert.equal(i.banco, '', `${i.nome}: banco inventado "${i.banco}"`);
    assert.equal(i.data_valor, '2026-11-11', `${i.nome}: data inventada ${i.data_valor}`);
  }
  assert.equal(itens.find((i) => i.ticker === 'CYCR11').corrigido_por_cotacao, true);
  assert.equal(cent(itens.filter((i) => i.ticker).reduce((a, i) => a + i.valor, 0)), 10768.62);
  assert.ok(conferencia.every((c) => c.confere === true), JSON.stringify(conferencia));
});

test('KF-1111b salvar na carteira: total 149.031,74, sem ticker repetido, mesmo com dados velhos errados', async () => {
  const banco = bancoFalso(); const antes = { db: p.deps.db, agora: p.deps.agora };
  let t = Date.parse('2026-11-12T10:00:00Z');
  p.deps.db = () => banco; p.deps.agora = () => new Date(t += 1000);
  try {
    // Carteira velha do dono, com banco inventado e valor errado.
    for (const [tk, b] of [['BTLG11', 'BTG'], ['CYCR11', ''], ['IVVB11', 'Nubank']]) {
      await p.agir('u1', { acao: 'carteira_salvar', nome: tk, ticker: tk, banco: b, tipo: 'renda_fixa', valor: ERRADO[tk] || 999, data_valor: '2024-02-26' });
    }
    const { itens } = await lerOsDoisPrints();
    for (const it of itens) await p.agir('u1', { acao: 'carteira_salvar', ...it });
    const lista = (await p.agir('u1', { acao: 'carteira_listar' }))[1].itens;
    const tickers = lista.filter((i) => i.ticker).map((i) => i.ticker);
    assert.equal(new Set(tickers).size, tickers.length, 'ticker repetido');
    assert.equal(lista.length, 15);
    assert.equal(cent(lista.reduce((a, i) => a + Number(i.valor), 0)), 149031.74);
    assert.equal(lista.find((i) => i.ticker === 'IVVB11').tipo, 'etf');
    assert.ok(!lista.some((i) => i.tipo === 'renda_fixa' && i.ticker), 'FII/ETF como renda fixa');
  } finally { Object.assign(p.deps, antes); }
});

test('KF-1111c chave do ativo: mesmo ticker com bancos diferentes é o mesmo ativo (tela = servidor)', () => {
  assert.equal(p.chaveAtivo({ ticker: 'BTLG11', banco: 'BTG' }), p.chaveAtivo({ ticker: 'btlg11', banco: '' }));
  for (const c of [{ ticker: 'MXRF11', banco: 'XP' }, { nome: 'CDB LIQUIDEZ DIARIA', banco: '' }]) assert.equal(chaveAtivo(c), p.chaveAtivo(c));
  assert.equal(p.tipoPeloTicker('IVVB11', 'fiis'), 'etf');
  assert.equal(p.tipoPeloTicker('TAEE11', 'fiis'), 'acoes');
  assert.equal(p.tipoPeloTicker('BTLG11', 'renda_fixa'), 'fiis');
});
