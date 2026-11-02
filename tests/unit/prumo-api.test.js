'use strict';
// Prumo (epic #2923): regras puras da API de finanças pessoais.
const test = require('node:test');
const assert = require('node:assert/strict');
const p = require('../../netlify/functions/prumo.js');
const { API_ROUTES, PUBLIC_DIRS, TENANT_PAGES } = require('../../lib/routes');

test('item da carteira: válido aceito, valor "1.234,56" vira número', () => {
  const r = p.validarItemCarteira({ nome: 'CDB Inter', banco: 'Inter', tipo: 'renda_fixa', valor: '1.234,56', data_valor: '2026-11-01' });
  assert.equal(r.ok, true);
  assert.equal(r.item.valor, 1234.56);
});

test('item da carteira: nome vazio, valor negativo e tipo inválido recusados', () => {
  assert.equal(p.validarItemCarteira({ nome: ' ', valor: 10 }).ok, false);
  assert.equal(p.validarItemCarteira({ nome: 'X', valor: -1 }).ok, false);
  assert.equal(p.validarItemCarteira({ nome: 'X', valor: 1, tipo: 'bitcoin-loko' }).ok, false);
});

test('resumoMes: compra de 300 em 3x = 100 por mês por 3 meses', () => {
  const g = [{ cartao_id: 'c1', descricao: 'TV', valor: 300, data: '2026-11-05', categoria: 'casa', parcelas: 3 }];
  assert.equal(p.resumoMes(g, '2026-11').total, 100);
  assert.equal(p.resumoMes(g, '2026-12').total, 100);
  assert.equal(p.resumoMes(g, '2027-01').total, 100);
  assert.equal(p.resumoMes(g, '2027-02').total, 0);
  assert.equal(p.resumoMes(g, '2026-12').gastos[0].parcela, '2/3');
  assert.equal(p.validarGasto({ cartao_id: 'c1', descricao: 'a', valor: 1, data: '2026-11-01', categoria: 'xx' }).ok, false);
});

test('avisos da lista de compras', () => {
  const agora = '2026-11-02T12:00:00.000Z';
  const listas = [
    { id: 'a', nome: 'Mercado', lembrete: '2026-11-01T10:00:00.000Z', itens: [{ nome: 'Arroz', comprado: false }] },
    { id: 'b', nome: 'Feira', lembrete: '2026-11-01T10:00:00.000Z', itens: [{ nome: 'Banana', comprado: true }] },
    { id: 'c', nome: 'Farmácia', lembrete: '2026-11-05T10:00:00.000Z', itens: [{ nome: 'Remédio', comprado: false }] },
  ];
  const av = p.avisosPendentes(listas, agora);
  assert.deepEqual(av.map((a) => a.id), ['a']);
});

test('objetivos: meta 100000 com 25000 = 25%', () => {
  const [o] = p.progressoObjetivos([{ id: 'apo', nome: 'Aposentadoria', meta: 100000, prazo: '2027-11' }], [{ objetivo_id: 'apo', valor: 25000 }, { valor: 999 }], '2026-11');
  assert.equal(o.percentual, 25);
  assert.equal(o.falta, 75000);
  assert.equal(o.por_mes, 6250);
  assert.equal(p.validarObjetivo({ nome: 'Carro', meta: 0, prazo: '2027-01' }).ok, false);
});

test('histórico: último registro de cada mês e variação', () => {
  const h = p.resumoHistorico([{ id: '2026-10-02', total: 900 }, { id: '2026-10-30', total: 1000 }, { id: '2026-11-02', total: 1100 }]);
  assert.deepEqual(h.pontos, [{ mes: '2026-10', total: 1000 }, { mes: '2026-11', total: 1100 }]);
  assert.deepEqual(h.variacao, { valor: 100, percentual: 10 });
});

test('extrairJson aceita cerca ```json e texto em volta', () => {
  assert.deepEqual(p.extrairJson('Aqui está:\n```json\n{"itens":[{"nome":"A"}]}\n```\nfim'), { itens: [{ nome: 'A' }] });
  assert.equal(p.extrairJson('sem json'), null);
});

test('prints: de 1 a 5, só imagem', () => {
  assert.ok(p.lerImagensEntrada({ imagens: [] }).erro);
  assert.ok(p.lerImagensEntrada({ imagens: ['data:text/plain;base64,AAAA'] }).erro);
  assert.ok(p.lerImagensEntrada({ imagens: Array(6).fill('data:image/png;base64,AAAA') }).erro);
  assert.equal(p.lerImagensEntrada({ imagens: ['data:image/png;base64,AAAA'] }).images.length, 1);
});

test('handler: sem login responde 401; rota e pasta registradas', async () => {
  const r = await p.handler({ httpMethod: 'POST', headers: {}, body: '{"acao":"carteira_listar"}' });
  assert.equal(r.statusCode, 401);
  assert.equal(API_ROUTES['/api/prumo'], 'prumo');
  assert.ok(PUBLIC_DIRS.includes('prumo'));
  assert.deepEqual(TENANT_PAGES['/prumo'], ['prumo', 'index.html']);
});
