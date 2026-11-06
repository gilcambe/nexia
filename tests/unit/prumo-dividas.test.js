'use strict';
// Kernex Finance, fase 9: dívidas e plano de quitação. Todo cálculo vem do motor.
const test = require('node:test');
const assert = require('node:assert/strict');
const p = require('../../netlify/functions/prumo.js');
const m = require('../../netlify/functions/prumo-lib/motor');
const { validarDivida, resumoDividas, riscoLiquidez } = require('../../netlify/functions/prumo-lib/dividas');
const { saudeFinanceira } = require('../../netlify/functions/prumo-lib/saude');

const CASO = [{ credor: 'Cartão', saldo: 2000, juros_mes: 5, parcela: 150 }, { credor: 'Loja', saldo: 500, juros_mes: 1, parcela: 50 }];

test('KV1. simulação conferida à mão: R$ 1.000 a 1% com parcela de R$ 500 quita em 3 meses pagando R$ 15,25 de juros', () => {
  const r = m.simularQuitacao([{ saldo: 1000, juros_mes: 1, parcela: 500 }], { rolar: false });
  assert.equal(r.meses, 3);
  assert.equal(r.juros_pagos, 15.25);
  assert.equal(r.total_pago, 1015.25);
  const zero = m.simularQuitacao([{ saldo: 1000, juros_mes: 0, parcela: 100 }], { rolar: false });
  assert.equal(zero.meses, 10);
  assert.equal(zero.juros_pagos, 0);
});

test('KV2. parcela que nem cobre os juros nunca quita: o motor diz "nunca" em vez de inventar prazo', () => {
  const r = m.simularQuitacao([{ saldo: 1000, juros_mes: 10, parcela: 100 }], { rolar: false });
  assert.equal(r.nunca, true);
  assert.equal(r.meses, null);
  assert.equal(r.juros_pagos, null);
});

test('KV3. avalanche paga menos juros que bola de neve num caso conhecido, e as duas economizam contra pagar só o mínimo', () => {
  const c = m.compararEstrategias(CASO, 100);
  assert.equal(c.so_minimo.juros_pagos, 1408.05);
  assert.equal(c.avalanche.juros_pagos, 648.48);
  assert.equal(c.bola_de_neve.juros_pagos, 743.51);
  assert.ok(c.avalanche.juros_pagos < c.bola_de_neve.juros_pagos);
  assert.equal(c.diferenca_avalanche_bola, 95.03);
  assert.equal(c.melhor, 'avalanche');
  assert.equal(c.avalanche.economia_vs_minimo, 759.57);
  assert.equal(c.avalanche.meses, 11);
});

test('KV4. quitação antecipada usa o valor à vista na dívida de maior juro e mostra a economia', () => {
  const q = m.quitacaoAntecipada(CASO, 500, 100);
  assert.equal(q.alvo, 'Cartão');
  assert.equal(q.valor_usado, 500);
  assert.equal(q.juros_sem, 648.48);
  assert.equal(q.juros_com, 356.05);
  assert.equal(q.economia, 292.43);
  assert.ok(q.meses_com < q.meses_sem);
});

test('KV5. renegociar: parcela da proposta pela fórmula Price, custo total com taxas e se compensa', () => {
  const r = m.renegociar({ saldo: 2000, parcela_atual: 150, juros_mes_atual: 5, nova_taxa_mes: 2, prazo_meses: 12, taxa_fixa: 50 });
  assert.equal(r.nova.parcela, 193.85);
  assert.equal(r.nova.custo_total_juros_e_taxas, 326.2);
  assert.equal(r.compensa, true);
  const ruim = m.renegociar({ saldo: 2000, parcela_atual: 400, juros_mes_atual: 1, nova_taxa_mes: 6, prazo_meses: 24 });
  assert.equal(ruim.compensa, false);
});

test('KV6. valida dívida: recusa sem credor, saldo zero, juros absurdos e vencimento 40; aceita "1.234,56"', () => {
  assert.equal(validarDivida({ credor: 'Banco', saldo: '1.234,56', juros_mes: '2,5', parcela: 100 }).item.saldo, 1234.56);
  assert.equal(validarDivida({ saldo: 10 }).ok, false);
  assert.equal(validarDivida({ credor: 'x', saldo: 0 }).ok, false);
  assert.equal(validarDivida({ credor: 'x', saldo: 10, juros_mes: 80 }).ok, false);
  assert.equal(validarDivida({ credor: 'x', saldo: 10, dia_vencimento: 40 }).ok, false);
  assert.equal(validarDivida({ credor: 'x', saldo: 10, tipo: 'foo' }).ok, false);
});

test('KV7. saúde: dívida não cadastrada = lacuna (não presume zero); "não tenho dívidas" = nota 100; com dívida mede renda comprometida e juros', () => {
  const base = { receitas: 5000, despesas: 4000, saldo: 12000, despesaMedia: 4000, limiteTotal: 0, comprometido: 0, limites: [] };
  assert.ok(saudeFinanceira({ ...base, dividas: resumoDividas([], false, 5000) }).lacunas.some((l) => /dívidas/.test(l)));
  const sem = saudeFinanceira({ ...base, dividas: resumoDividas([], true, 5000) });
  assert.equal(sem.indicadores.find((x) => x.id === 'endividamento').nota, 100);
  const com = saudeFinanceira({ ...base, dividas: resumoDividas([{ saldo: 3000, juros_mes: 5, parcela: 1000 }], false, 5000) });
  assert.equal(com.indicadores.find((x) => x.id === 'endividamento').valor, 20);
  assert.ok(com.indicadores.find((x) => x.id === 'juros'));
});

test('KV8. risco de liquidez: extra maior que a sobra e à vista maior que o saldo são risco alto', () => {
  assert.equal(riscoLiquidez({ extra: 500, aVista: 0, economiaMensal: 200, saldo: 1000, despesaMedia: 3000 }).nivel, 'alto');
  assert.equal(riscoLiquidez({ extra: 0, aVista: 5000, economiaMensal: 200, saldo: 1000, despesaMedia: 3000 }).nivel, 'alto');
  assert.equal(riscoLiquidez({ extra: 100, aVista: 0, economiaMensal: 1000, saldo: 20000, despesaMedia: 3000 }).nivel, 'baixo');
  assert.equal(riscoLiquidez({ extra: 100, aVista: 0, economiaMensal: null, saldo: 20000, despesaMedia: 3000 }).nivel, 'médio');
});

function bancoFalso() {
  const dados = new Map();
  const col = (c) => ({ doc: (id) => ({ collection: (n) => col(`${c}/${id}/${n}`), set: async (v) => { dados.set(`${c}/${id}`, v); }, delete: async () => { dados.delete(`${c}/${id}`); }, get: async () => { const v = dados.get(`${c}/${id}`); return { exists: !!v, data: () => v }; } }),
    get: async () => ({ docs: [...dados.entries()].filter(([x]) => x.startsWith(c + '/') && !x.slice(c.length + 1).includes('/')).map(([x, v]) => ({ id: x.split('/').pop(), data: () => v })) }) });
  return { collection: col, dados };
}
async function comBanco(fn) {
  const banco = bancoFalso(); const antes = { db: p.deps.db, agora: p.deps.agora };
  p.deps.db = () => banco; p.deps.agora = () => new Date('2026-11-05T12:00:00Z');
  try { await fn(banco); } finally { Object.assign(p.deps, antes); }
}

test('KV9. API: cadastra, lista por juros, planeja, renegocia; Início desconta a dívida do patrimônio e a lacuna some', async () => {
  await comBanco(async () => {
    const inicio0 = (await p.agir('u1', { acao: 'inicio_resumo' }))[1];
    assert.ok(inicio0.lacunas.includes('dividas'));
    await p.agir('u1', { acao: 'conta_salvar', nome: 'Nubank', tipo: 'digital', saldo: 10000 });
    const a = await p.agir('u1', { acao: 'divida_salvar', credor: 'Cartão', tipo: 'cartao', saldo: 2000, juros_mes: 5, parcela: 150 });
    assert.equal(a[0], 200);
    await p.agir('u1', { acao: 'divida_salvar', credor: 'Loja', tipo: 'parcelamento', saldo: 500, juros_mes: 1, parcela: 50 });
    assert.equal((await p.agir('u1', { acao: 'divida_salvar', credor: '', saldo: 10 }))[0], 400);
    const lista = (await p.agir('u1', { acao: 'divida_listar' }))[1];
    assert.deepEqual(lista.dividas.map((d) => d.credor), ['Cartão', 'Loja']);
    assert.equal(lista.resumo.total, 2500);
    const plano = (await p.agir('u1', { acao: 'divida_plano', extra: 100, a_vista: 500 }))[1];
    assert.equal(plano.estrategias.melhor, 'avalanche');
    assert.equal(plano.estrategias.avalanche.juros_pagos, 648.48);
    assert.equal(plano.quitacao_antecipada.economia, 292.43);
    assert.equal(plano.risco_liquidez.nivel, 'médio'); // sem receitas lançadas não sei se o extra cabe
    assert.equal((await p.agir('u1', { acao: 'divida_plano', extra: -5 }))[0], 400);
    const reneg = (await p.agir('u1', { acao: 'divida_renegociar', id: a[1].id, nova_taxa_mes: 2, prazo_meses: 12, taxa_fixa: 50 }))[1];
    assert.equal(reneg.nova.parcela, 193.85);
    assert.equal((await p.agir('u1', { acao: 'divida_renegociar', id: 'x', nova_taxa_mes: 2, prazo_meses: 12 }))[0], 400);
    const inicio = (await p.agir('u1', { acao: 'inicio_resumo' }))[1];
    assert.equal(inicio.patrimonio.liquido, 7500);
    assert.ok(!inicio.lacunas.includes('dividas'));
    assert.equal(inicio.dividas.total, 2500);
    const resp = (await p.agir('u1', { acao: 'assistente_perguntar', texto: 'Quanto eu devo?' }))[1];
    assert.match(resp.resposta, /2\.500,00/);
    await p.agir('u1', { acao: 'divida_apagar', id: a[1].id });
    assert.equal((await p.agir('u1', { acao: 'divida_listar' }))[1].dividas.length, 1);
  });
});

test('KV10. "não tenho dívidas": só vale se a pessoa declarar; cadastrar uma dívida depois desfaz a declaração', async () => {
  await comBanco(async () => {
    await p.agir('u1', { acao: 'divida_nenhuma' });
    assert.equal((await p.agir('u1', { acao: 'divida_listar' }))[1].sem_dividas, true);
    assert.ok(!(await p.agir('u1', { acao: 'inicio_resumo' }))[1].lacunas.includes('dividas'));
    assert.match((await p.agir('u1', { acao: 'assistente_perguntar', texto: 'quanto eu devo' }))[1].resposta, /não tem dívidas/);
    await p.agir('u1', { acao: 'divida_salvar', credor: 'Banco', saldo: 100 });
    assert.equal((await p.agir('u1', { acao: 'divida_listar' }))[1].sem_dividas, false);
    assert.equal((await p.agir('u1', { acao: 'divida_plano' }))[1].sem_dividas, undefined);
  });
});
