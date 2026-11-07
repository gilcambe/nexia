'use strict';
// Kernex Finance, fase 2: leitor de documentos, conferência, gravação sem duplicar e resumo do Início.
const test = require('node:test');
const assert = require('node:assert/strict');
const p = require('../../netlify/functions/prumo.js');
const { normalizarLancamento, idDe } = require('../../netlify/functions/prumo-lib/documentos');

function bancoFalso() {
  const dados = new Map();
  const col = (caminho) => ({
    doc: (id) => ({
      collection: (n) => col(`${caminho}/${id}/${n}`),
      set: async (v) => { dados.set(`${caminho}/${id}`, v); },
      delete: async () => { dados.delete(`${caminho}/${id}`); },
      get: async () => { const v = dados.get(`${caminho}/${id}`); return { exists: !!v, data: () => v }; },
    }),
    get: async () => ({ docs: [...dados.entries()].filter(([k]) => k.startsWith(caminho + '/') && !k.slice(caminho.length + 1).includes('/')).map(([k, v]) => ({ id: k.split('/').pop(), data: () => v })) }),
  });
  return { collection: col, dados };
}
async function comBanco(fn, extra) {
  const banco = bancoFalso();
  const antes = { db: p.deps.db, agora: p.deps.agora, getRouter: p.deps.getRouter, listFor: p.deps.listFor };
  p.deps.db = () => banco;
  p.deps.agora = () => new Date('2026-11-05T12:00:00Z');
  if (extra) Object.assign(p.deps, extra);
  try { await fn(banco); } finally { Object.assign(p.deps, antes); }
}
const PNG = 'data:image/png;base64,iVBORw0KGgo=';

test('KD1. normaliza: valor "1.234,56", data BR, tipo apelidado; recusa sem data, sem valor e tipo desconhecido', () => {
  const ok = normalizarLancamento({ data: '02/11/2026', valor: 'R$ 1.234,56', descricao: 'Mercado', tipo: 'Compra', categoria: 'Alimentação' }, { tipo_documento: 'fatura' });
  assert.equal(ok.ok, true);
  assert.equal(ok.item.valor, 1234.56);
  assert.equal(ok.item.data, '2026-11-02');
  assert.equal(ok.item.tipo, 'despesa');
  assert.equal(ok.item.categoria, 'alimentacao');
  assert.equal(ok.item.documento, 'fatura');
  assert.equal(normalizarLancamento({ valor: 10, descricao: 'x', tipo: 'despesa' }).ok, false);
  assert.equal(normalizarLancamento({ data: '2026-11-02', descricao: 'x', tipo: 'despesa' }).ok, false);
  assert.equal(normalizarLancamento({ data: '2026-11-02', valor: 10, descricao: 'x', tipo: '???' }).ok, false);
  assert.equal(normalizarLancamento({ data: '2026-11-02', valor: 10, descricao: 'Pagamento de fatura', tipo: 'pagamento fatura' }).item.tipo, 'pagamento_fatura');
});

test('KD2. doc_ler: IA falsa lê fatura; duplicata, baixa confiança e dados ruins vão para conferir; nada é gravado ainda', async () => {
  const lido = { tipo_documento: 'fatura', instituicao: 'Nubank', lancamentos: [
    { data: '2026-11-02', valor: 100, estabelecimento: 'Mercado Zé', descricao: 'Mercado Zé', tipo: 'despesa', categoria: 'alimentacao', confianca: 0.95 },
    { data: '2026-11-02', valor: 100, estabelecimento: 'MERCADO ZE', descricao: 'MERCADO ZE', tipo: 'despesa', categoria: 'alimentacao', confianca: 0.95 },
    { data: '2026-11-03', valor: 50, descricao: 'borrado', tipo: 'despesa', confianca: 0.3 },
    { data: '', valor: 10, descricao: 'sem data', tipo: 'despesa' },
    { data: '2026-11-04', valor: 2000, descricao: 'Pagamento fatura', tipo: 'pagamento_fatura' },
  ] };
  const router = { capabilities: () => ({ available: true, vision: true }), chat: async () => ({ text: JSON.stringify(lido) }) };
  await comBanco(async (banco) => {
    const r = await p.agir('u1', { acao: 'doc_ler', imagens: [PNG] });
    assert.equal(r[0], 200);
    assert.equal(r[1].prontos.length, 2); // mercado (1x) + pagamento da fatura
    assert.equal(r[1].despesas, 100);
    assert.equal(r[1].conferir.length, 3);
    assert.equal([...banco.dados.keys()].filter((k) => k.includes('/lancamentos/')).length, 0);
  }, { getRouter: () => router, listFor: () => [] });
});

test('KD3. doc_confirmar grava uma vez; reenviar o mesmo documento não duplica; forçar mantém a pedido da pessoa', async () => {
  const l = { data: '2026-11-02', valor: 100, estabelecimento: 'Mercado Zé', descricao: 'Mercado Zé', tipo: 'despesa', categoria: 'alimentacao' };
  await comBanco(async () => {
    const a = await p.agir('u1', { acao: 'doc_confirmar', lancamentos: [l, { ...l, descricao: 'MERCADO ZE', estabelecimento: 'MERCADO ZE' }] });
    assert.equal(a[1].gravados, 1);
    const b = await p.agir('u1', { acao: 'doc_confirmar', lancamentos: [l] });
    assert.equal(b[1].gravados, 0);
    assert.equal(b[1].ja_existiam, 1);
    const c = await p.agir('u1', { acao: 'doc_confirmar', lancamentos: [{ ...l, forcar: true }] });
    assert.equal(c[1].gravados, 1);
    const lista = await p.agir('u1', { acao: 'lanc_listar', mes: '2026-11' });
    assert.equal(lista[1].lancamentos.length, 2);
    assert.equal(lista[1].despesas, 200);
    const vazio = await p.agir('u1', { acao: 'doc_confirmar', lancamentos: [] });
    assert.equal(vazio[0], 400);
  });
});

test('KD4. inicio_resumo: receitas, despesas e economia do mês só com tipos que contam; patrimônio vem da carteira; avisa lacunas', async () => {
  await comBanco(async () => {
    await p.agir('u1', { acao: 'carteira_salvar', nome: 'CDB', tipo: 'renda_fixa', valor: 1000 });
    await p.agir('u1', { acao: 'doc_confirmar', lancamentos: [
      { data: '2026-11-01', valor: 3000, descricao: 'Salário', tipo: 'receita' },
      { data: '2026-11-02', valor: 800, descricao: 'Aluguel', tipo: 'despesa', categoria: 'moradia' },
      { data: '2026-11-03', valor: 500, descricao: 'TED própria', tipo: 'transferencia_propria' },
      { data: '2026-11-04', valor: 700, descricao: 'Pagamento fatura', tipo: 'pagamento_fatura' },
      { data: '2026-10-10', valor: 400, descricao: 'Mercado', tipo: 'despesa', categoria: 'alimentacao' },
    ] });
    const r = (await p.agir('u1', { acao: 'inicio_resumo' }))[1];
    assert.equal(r.mes, '2026-11');
    assert.equal(r.receitas, 3000);
    assert.equal(r.despesas, 800);
    assert.equal(r.economia, 2200);
    assert.equal(r.despesas_mes_anterior, 400);
    assert.equal(r.variacao_despesas_pct, 100);
    assert.deepEqual(r.por_categoria, { moradia: 800 });
    assert.equal(r.patrimonio.liquido, 1000);
    assert.ok(r.lacunas.includes('dividas'));
  });
});

test('KD5. doc_ler recusa imagem inválida e devolve 503 quando nenhuma IA consegue ler', async () => {
  await comBanco(async () => {
    assert.equal((await p.agir('u1', { acao: 'doc_ler', imagens: ['nao-e-imagem'] }))[0], 400);
    assert.equal((await p.agir('u1', { acao: 'doc_ler', imagens: [PNG] }))[0], 503);
  }, { getRouter: () => ({ capabilities: () => ({ available: false }), chat: async () => null }), listFor: () => [] });
});

test('KD6. id do lançamento é igual para a mesma compra escrita de jeitos diferentes', () => {
  assert.equal(idDe({ data: '2026-11-02', valor: 100, estabelecimento: 'Mercado Zé' }), idDe({ data: '2026-11-02', valor: 100, estabelecimento: 'MERCADO ZE' }));
  assert.notEqual(idDe({ data: '2026-11-02', valor: 100, estabelecimento: 'A' }), idDe({ data: '2026-11-03', valor: 100, estabelecimento: 'A' }));
});

test('conta de consumo só com vencimento não é descartada (usa o vencimento como data)', () => {
  const d = require('../../netlify/functions/prumo-lib/documentos');
  const r = d.normalizarLancamento({ descricao: 'Energia elétrica', valor: '236,48', vencimento: '25/10/2026', tipo: 'despesa', categoria: 'moradia' }, { tipo_documento: 'conta' });
  assert.equal(r.ok, true);
  assert.equal(r.item.data, '2026-10-25');
  assert.equal(r.item.valor, 236.48);
});
