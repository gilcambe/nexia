'use strict';
// Kernex Finance, fase 7: investimentos. Juros compostos em centavos, concentração, cotação com fonte/data.
const test = require('node:test');
const assert = require('node:assert/strict');
const p = require('../../netlify/functions/prumo.js');
const m = require('../../netlify/functions/prumo-lib/motor');

test('KI1. juros compostos com aportes: R$ 1.000 + R$ 100/mês a 1% por 12 meses fecha em centavos', () => {
  const r = m.jurosCompostos({ inicial: 1000, aporte: 100, taxa_mes: 1, meses: 12 });
  assert.equal(r.final, 2395.07);
  assert.equal(r.investido, 2200);
  assert.equal(r.rendimento, 195.07);
  assert.equal(r.serie.length, 1);
  const zero = m.jurosCompostos({ inicial: 0, aporte: 100, taxa_mes: 0, meses: 10 });
  assert.equal(zero.final, 1000);
  assert.equal(zero.rendimento, 0);
});

test('KI2. concentração avisa ativo grande demais; carteira vazia vira lacuna, não zero', () => {
  const c = m.concentracao([{ nome: 'PETR4', tipo: 'acoes', valor: 800 }, { nome: 'CDB', tipo: 'renda_fixa', valor: 200 }]);
  assert.equal(c.total, 1000);
  assert.equal(c.por_ativo[0].pct, 80);
  assert.ok(c.alertas.length >= 1);
  const v = m.concentracao([]);
  assert.equal(v.total, null);
  assert.ok(v.lacuna);
});

test('KI3. cotação sem fonte ou velha é marcada desatualizada', () => {
  const agora = '2026-11-05T12:00:00Z';
  assert.equal(m.cotacaoStatus({ preco: 10, fonte: 'Corretora', data_hora: '2026-11-05T09:00:00Z' }, agora).desatualizada, false);
  assert.equal(m.cotacaoStatus({ preco: 10, fonte: 'Corretora', data_hora: '2026-10-20T09:00:00Z' }, agora).desatualizada, true);
  const sem = m.cotacaoStatus({ preco: 10, data_hora: '2026-11-05T09:00:00Z' }, agora);
  assert.equal(sem.valida, false);
  assert.equal(sem.desatualizada, true);
});

test('KI4. rentabilidade: sem custo conhecido não inventa', () => {
  assert.deepEqual(m.rentabilidade(1000, 1100), { ganho: 100, pct: 10 });
  assert.equal(m.rentabilidade(0, 100), null);
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

test('KI5. API: simula, registra cotação com fonte, calendário e análise sem recomendar compra', async () => {
  await comBanco(async () => {
    const s = (await p.agir('u1', { acao: 'invest_simular', inicial: 1000, aporte: 100, taxa_mes: 1, anos: 1 }))[1];
    assert.equal(s.final, 2395.07);
    assert.match(s.aviso, /não é recomendação/);
    assert.equal((await p.agir('u1', { acao: 'invest_simular', taxa_mes: 50, anos: 1 }))[0], 400);

    const a = (await p.agir('u1', { acao: 'carteira_salvar', nome: 'PETR4', banco: 'Corretora', tipo: 'acoes', valor: 800, data_valor: '2026-11-01', ticker: 'PETR4', quantidade: 20, preco_medio: 30 }))[1];
    await p.agir('u1', { acao: 'carteira_salvar', nome: 'CDB', banco: 'Banco', tipo: 'renda_fixa', valor: 200, data_valor: '2026-11-01', vencimento: '2026-12-10' });
    assert.equal((await p.agir('u1', { acao: 'invest_cotacao', id: a.id, preco: 40 }))[0], 400); // sem fonte
    const ok = (await p.agir('u1', { acao: 'invest_cotacao', id: a.id, preco: 40, fonte: 'Corretora X', data_hora: '2026-11-05T10:00:00Z' }))[1];
    assert.equal(ok.cotacao.desatualizada, false);
    await p.agir('u1', { acao: 'invest_dividendo_salvar', ativo: 'PETR4', data: '2026-11-20', valor: 55.5, tipo: 'dividendo' });
    const v = (await p.agir('u1', { acao: 'invest_visao' }))[1];
    const petr = v.itens.find((x) => x.nome === 'PETR4');
    assert.equal(petr.custo, 600);
    assert.equal(petr.valor_cotado, 800);
    assert.equal(petr.rentabilidade.pct, 33.33);
    assert.equal(v.calendario.length, 2);
    assert.equal(v.calendario[0].nome, 'PETR4');
    assert.ok(v.lacunas.some((l) => /sem cotação/.test(l))); // CDB sem cotação
    const an = (await p.agir('u1', { acao: 'invest_analise' }))[1];
    assert.ok(an.observacoes.some((o) => /PETR4/.test(o)));
    assert.match(an.aviso, /não é recomendação/);
    assert.ok(!/compre|venda/i.test(JSON.stringify(an.observacoes)));
  });
});

test('KI6. cotação antiga aparece desatualizada na visão', async () => {
  await comBanco(async () => {
    const a = (await p.agir('u1', { acao: 'carteira_salvar', nome: 'ITUB4', banco: 'C', tipo: 'acoes', valor: 100, data_valor: '2026-11-01', quantidade: 10, preco_medio: 9 }))[1];
    await p.agir('u1', { acao: 'invest_cotacao', id: a.id, preco: 11, fonte: 'Site', data_hora: '2026-10-01T10:00:00Z' });
    const v = (await p.agir('u1', { acao: 'invest_visao' }))[1];
    assert.equal(v.itens[0].cotacao.desatualizada, true);
  });
});
