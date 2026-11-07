'use strict';
// Kernex Finance, fase 8: milhas. Custo do milheiro, resgate, cartão ideal, promoção só com fonte.
const test = require('node:test');
const assert = require('node:assert/strict');
const p = require('../../netlify/functions/prumo.js');
const m = require('../../netlify/functions/prumo-lib/motor');

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

test('KM1. resgate: R$ 1.500 de passagem com R$ 100 de taxas por 50.000 milhas = R$ 28,00 o milheiro', () => {
  const r = m.resgateMilhas({ milhas: 50000, preco_dinheiro: 1500, taxas: 100, referencia: 20 });
  assert.equal(r.valor_milheiro_resgate, 28);
  assert.equal(r.compensa, true);
  assert.equal(m.resgateMilhas({ milhas: 50000, preco_dinheiro: 1500, taxas: 100, referencia: 35 }).compensa, false);
  assert.equal(m.resgateMilhas({ milhas: 50000, preco_dinheiro: 1500, taxas: 100 }).compensa, null);
});

test('KM2. API: custo médio do milheiro, vencimento, resgate contra o custo pago', async () => {
  await comBanco(async () => {
    await p.agir('u1', { acao: 'pontos_salvar', programa: 'Smiles', saldo: 50000, validade: '2026-11-20', valor_milheiro: 20 });
    await p.agir('u1', { acao: 'pontos_salvar', programa: 'Livelo', saldo: 10000 });
    assert.equal((await p.agir('u1', { acao: 'milhas_compra_salvar', programa: 'Smiles', milhas: 0, preco: 10 }))[0], 400);
    await p.agir('u1', { acao: 'milhas_compra_salvar', programa: 'Smiles', milhas: 20000, preco: 500 });
    await p.agir('u1', { acao: 'milhas_compra_salvar', programa: 'smiles', milhas: 10000, preco: 400 });
    const v = (await p.agir('u1', { acao: 'milhas_visao' }))[1];
    const sm = v.programas.find((x) => x.programa === 'Smiles');
    assert.equal(sm.custo_aquisicao, 900);
    assert.equal(sm.custo_milheiro, 30);
    assert.equal(sm.a_vencer_30d, 50000);
    assert.equal(v.programas.find((x) => x.programa === 'Livelo').custo_milheiro, null);
    assert.ok(v.lacunas.some((l) => /Sem compras/.test(l)));
    const r = (await p.agir('u1', { acao: 'milhas_resgate', programa: 'Smiles', milhas: 50000, preco_dinheiro: 1500, taxas: 100 }))[1];
    assert.equal(r.valor_milheiro_resgate, 28);
    assert.equal(r.referencia, 30);
    assert.equal(r.compensa, false); // 28 < 30 pago
    assert.equal(r.referencia_tipo, 'custo médio pago');
    assert.equal((await p.agir('u1', { acao: 'milhas_resgate', milhas: 100, preco_dinheiro: 50, taxas: 80 }))[0], 400);
  });
});

test('KM3. promoção só com fonte e validade; vencida some', async () => {
  await comBanco(async () => {
    assert.equal((await p.agir('u1', { acao: 'milhas_promo_salvar', titulo: 'Bônus 100%', validade: '2026-12-01' }))[0], 400); // sem fonte
    assert.equal((await p.agir('u1', { acao: 'milhas_promo_salvar', titulo: 'Bônus 100%', fonte: 'E-mail Livelo' }))[0], 400); // sem validade
    await p.agir('u1', { acao: 'milhas_promo_salvar', titulo: 'Bônus 100%', programa: 'Livelo', fonte: 'E-mail Livelo', validade: '2026-12-01', bonus_pct: 100 });
    await p.agir('u1', { acao: 'milhas_promo_salvar', titulo: 'Velha', fonte: 'Site', validade: '2026-10-01' });
    const v = (await p.agir('u1', { acao: 'milhas_visao' }))[1];
    assert.deepEqual(v.promocoes.map((x) => x.titulo), ['Bônus 100%']);
    assert.equal(v.promocoes[0].fonte, 'E-mail Livelo');
  });
});

test('KM4. cartão ideal: ranking pelo líquido anual; cartão sem dados fica fora e avisado', async () => {
  await comBanco(async () => {
    await p.agir('u1', { acao: 'cartao_salvar', nome: 'Alfa', anuidade: 600, pontos_por_real: 2, valor_milheiro: 20, dia_fechamento: 5, dia_vencimento: 12 });
    await p.agir('u1', { acao: 'cartao_salvar', nome: 'Beta', anuidade: 0, cashback_pct: 1, dia_fechamento: 5, dia_vencimento: 12 });
    await p.agir('u1', { acao: 'cartao_salvar', nome: 'Gama', anuidade: 0, dia_fechamento: 5, dia_vencimento: 12 });
    const r = (await p.agir('u1', { acao: 'milhas_cartao_ideal', gasto_mensal: 5000 }))[1];
    assert.equal(r.ranking[0].nome, 'Alfa'); // 4% * 60000 = 2400 - 600
    assert.equal(r.ranking[0].liquido_anual, 1800);
    assert.equal(r.ranking[1].liquido_anual, 600);
    assert.deepEqual(r.sem_dados.map((x) => x.nome), ['Gama']);
  });
});
