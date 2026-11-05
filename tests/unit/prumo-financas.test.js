'use strict';
// Kernex Finance, fase 3: contas, saldo disponível e limites por categoria.
const test = require('node:test');
const assert = require('node:assert/strict');
const p = require('../../netlify/functions/prumo.js');
const { validarConta, validarLimite, saldoDisponivel, consumoLimites } = require('../../netlify/functions/prumo-lib/financas');

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
async function comBanco(fn) {
  const banco = bancoFalso();
  const antes = { db: p.deps.db, agora: p.deps.agora };
  p.deps.db = () => banco;
  p.deps.agora = () => new Date('2026-11-05T12:00:00Z');
  try { await fn(banco); } finally { Object.assign(p.deps, antes); }
}

test('KC1. conta: aceita saldo "1.234,56" e negativo; recusa sem nome, tipo inválido e saldo que não é número', () => {
  assert.equal(validarConta({ nome: 'Nubank', tipo: 'digital', saldo: '1.234,56' }).item.saldo, 1234.56);
  assert.equal(validarConta({ nome: 'Itaú', saldo: -50 }).item.saldo, -50);
  assert.equal(validarConta({ saldo: 1 }).ok, false);
  assert.equal(validarConta({ nome: 'x', tipo: 'foo', saldo: 1 }).ok, false);
  assert.equal(validarConta({ nome: 'x', saldo: 'abc' }).ok, false);
  assert.equal(validarConta({ nome: 'Wise', tipo: 'internacional', saldo: 10 }).item.moeda, 'USD');
});

test('KC2. saldo disponível: null sem contas; soma em centavos só em reais; outra moeda fica à parte', () => {
  assert.equal(saldoDisponivel([]).saldo, null);
  const r = saldoDisponivel([{ nome: 'A', saldo: 0.1, moeda: 'BRL' }, { nome: 'B', saldo: 0.2, moeda: 'BRL' }, { nome: 'Wise', saldo: 500, moeda: 'USD' }]);
  assert.equal(r.saldo, 0.3);
  assert.deepEqual(r.outras_moedas, [{ nome: 'Wise', saldo: 500, moeda: 'USD' }]);
});

test('KC3. limites: ok abaixo de 80%, atenção de 80% a 100%, estourado acima; ordenado do mais perto de estourar', () => {
  const r = consumoLimites([{ categoria: 'alimentacao', limite: 850 }, { categoria: 'lazer', limite: 300 }, { categoria: 'compras', limite: 400 }, { categoria: 'transporte', limite: 500 }],
    { alimentacao: 800, lazer: 336, compras: 180 });
  assert.deepEqual(r.map((x) => [x.categoria, x.status]), [['lazer', 'estourado'], ['alimentacao', 'atencao'], ['compras', 'ok'], ['transporte', 'ok']]);
  assert.equal(r[0].restante, -36);
  assert.equal(validarLimite({ categoria: 'lazer', limite: 0 }).ok, false);
  assert.equal(validarLimite({ categoria: 'xyz', limite: 10 }).ok, false);
});

test('KC4. API: contas e limites gravam e listam; Início mostra saldo, alerta de limite e some a lacuna de contas', async () => {
  await comBanco(async () => {
    const a = await p.agir('u1', { acao: 'conta_salvar', nome: 'Nubank', tipo: 'digital', saldo: 2500 });
    assert.equal(a[0], 200);
    await p.agir('u1', { acao: 'conta_salvar', nome: 'Wise', tipo: 'internacional', saldo: 100, moeda: 'USD' });
    const lista = await p.agir('u1', { acao: 'conta_listar' });
    assert.equal(lista[1].saldo, 2500);
    assert.equal(lista[1].outras_moedas.length, 1);
    assert.equal((await p.agir('u1', { acao: 'conta_salvar', nome: '', saldo: 1 }))[0], 400);
    await p.agir('u1', { acao: 'limite_salvar', categoria: 'lazer', limite: 300 });
    await p.agir('u1', { acao: 'doc_confirmar', lancamentos: [{ data: '2026-11-02', valor: 336, descricao: 'Cinema e jantar', tipo: 'despesa', categoria: 'lazer' }, { data: '2026-11-03', valor: 5000, descricao: 'Salário', tipo: 'receita' }] });
    const r = (await p.agir('u1', { acao: 'inicio_resumo' }))[1];
    assert.equal(r.saldo_disponivel, 2500);
    assert.equal(r.alertas_limite.length, 1);
    assert.equal(r.alertas_limite[0].status, 'estourado');
    assert.equal(r.patrimonio.liquido, 2500);
    assert.ok(!r.lacunas.includes('contas'));
    const lim = await p.agir('u1', { acao: 'limite_listar', mes: '2026-11' });
    assert.equal(lim[1].limites[0].gasto, 336);
    await p.agir('u1', { acao: 'limite_apagar', id: 'lazer' });
    assert.equal((await p.agir('u1', { acao: 'limite_listar' }))[1].limites.length, 0);
    await p.agir('u1', { acao: 'conta_apagar', id: a[1].id });
    assert.equal((await p.agir('u1', { acao: 'conta_listar' }))[1].contas.length, 1);
  });
});

test('KC5. sem contas o saldo disponível é null e a lacuna "contas" aparece', async () => {
  await comBanco(async () => {
    const r = (await p.agir('u1', { acao: 'inicio_resumo' }))[1];
    assert.equal(r.saldo_disponivel, null);
    assert.ok(r.lacunas.includes('contas'));
  });
});
