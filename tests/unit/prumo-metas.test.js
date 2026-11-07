'use strict';
// Kernex Finance, fase 11: metas, simulador com inflação/imposto, cofres, independência financeira.
const test = require('node:test');
const assert = require('node:assert/strict');
const p = require('../../netlify/functions/prumo.js');
const m = require('../../netlify/functions/prumo-lib/motor');

test('KT1. simulador com inflação e imposto dá valor conhecido: R$ 1.000 a 10% ao ano, 15% de imposto, 5% de inflação, 1 ano', () => {
  const r = m.projecaoReal({ inicial: 1000, taxa_ano: 10, inflacao_ano: 5, imposto_pct: 15, anos: 1 });
  assert.equal(r.bruto, 1100);
  assert.equal(r.imposto, 15);
  assert.equal(r.liquido, 1085);
  assert.equal(r.real, 1033.33);
  const sem = m.projecaoReal({ aporte: 100, taxa_ano: 0, anos: 2 });
  assert.equal(sem.bruto, 2400);
  assert.equal(sem.imposto, 0);
});

test('KT2. independência financeira: gasto R$ 5.000 com retirada de 4% pede R$ 1.500.000; sem rendimento e aporte o prazo é conhecido', () => {
  const r = m.independenciaFinanceira({ gasto_mensal: 5000, retirada_pct: 4, atual: 0, aporte: 10000, taxa_ano: 0, inflacao_ano: 0 });
  assert.equal(r.alvo, 1500000);
  assert.equal(r.meses, 150);
  assert.equal(r.anos, 12.5);
  assert.equal(m.independenciaFinanceira({ gasto_mensal: 5000, atual: 0, aporte: 0 }).meses, null); // nunca chega
  assert.equal(m.mesesParaMeta({ atual: 500, meta: 500 }), 0);
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

test('KT3. API: simula, valida premissas e roda independência', async () => {
  await comBanco(async () => {
    const s = (await p.agir('u1', { acao: 'meta_simular', inicial: 1000, taxa_ano: 10, inflacao_ano: 5, imposto_pct: 15, anos: 1, meta: 1000 }))[1];
    assert.equal(s.real, 1033.33);
    assert.equal(s.atinge_meta, true);
    assert.match(s.aviso, /VOCÊ informou/);
    assert.equal((await p.agir('u1', { acao: 'meta_simular', anos: 1, taxa_ano: 500 }))[0], 400);
    const fi = (await p.agir('u1', { acao: 'meta_independencia', gasto_mensal: 5000, aporte: 10000 }))[1];
    assert.equal(fi.meses, 150);
    assert.equal((await p.agir('u1', { acao: 'meta_independencia', gasto_mensal: 0 }))[0], 400);
  });
});

test('KT4. cofre por objetivo soma com a carteira, não deixa retirar mais do que tem, e a visão calcula meses até a meta', async () => {
  await comBanco(async () => {
    const o = (await p.agir('u1', { acao: 'objetivo_salvar', nome: 'Casa', meta: 10000, prazo: '2030-01', aporte_mensal: 1000 }))[1];
    assert.equal((await p.agir('u1', { acao: 'cofre_mover', objetivo_id: o.id, valor: -50 }))[0], 400);
    assert.equal((await p.agir('u1', { acao: 'cofre_mover', objetivo_id: 'x', valor: 50 }))[0], 404);
    await p.agir('u1', { acao: 'cofre_mover', objetivo_id: o.id, valor: 2000, nota: 'bônus' });
    await p.agir('u1', { acao: 'cofre_mover', objetivo_id: o.id, valor: -500 });
    await p.agir('u1', { acao: 'carteira_salvar', nome: 'CDB', banco: 'B', tipo: 'renda_fixa', valor: 500, data_valor: '2026-11-01', objetivo_id: o.id });
    const v = (await p.agir('u1', { acao: 'meta_visao' }))[1];
    const ob = v.objetivos[0];
    assert.equal(ob.cofre, 1500);
    assert.equal(ob.da_carteira, 500);
    assert.equal(ob.atual, 2000);
    assert.equal(ob.percentual, 20);
    assert.equal(ob.meses_para_meta, 8); // faltam 8.000 com 1.000 por mês, sem rendimento
    assert.ok(v.reserva.lacuna); // sem despesas de meses anteriores
    assert.equal(v.marcos[0].marco, 10000);
  });
});
