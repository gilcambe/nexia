'use strict';
// Kernex Finance, fase 10: economizador e renda extra.
const test = require('node:test');
const assert = require('node:assert/strict');
const p = require('../../netlify/functions/prumo.js');
const e = require('../../netlify/functions/prumo-lib/economizador');

const L = (data, descricao, valor, extra = {}) => ({ data, descricao, estabelecimento: descricao, valor, tipo: 'despesa', ...extra });

test('KE1. assinatura mensal repetida é detectada (3 meses, valor parecido)', () => {
  const lancs = [L('2026-09-05', 'Netflix', 55.9), L('2026-10-05', 'Netflix', 55.9), L('2026-11-05', 'Netflix', 55.9), L('2026-11-02', 'Padaria', 12)];
  const v = e.visao(lancs, '2026-11');
  assert.equal(v.assinaturas.length, 1);
  assert.equal(v.assinaturas[0].estabelecimento, 'Netflix');
  assert.equal(v.assinaturas[0].por_ano, 670.8);
});

test('KE2. cobrança duplicada no mesmo dia é apontada para revisar', () => {
  const v = e.visao([L('2026-11-03', 'Loja X', 80), L('2026-11-03', 'Loja X', 80)], '2026-11');
  assert.equal(v.cobrancas_repetidas.length, 1);
  assert.match(v.aviso, /REVISAR/);
});

test('KE3. tarifas somadas e delivery acima da média detectado; sem histórico não compara', () => {
  const lancs = [L('2026-11-01', 'Anuidade cartão', 30), L('2026-11-02', 'Tarifa pacote', 20),
    L('2026-08-10', 'iFood', 100), L('2026-09-10', 'iFood', 100), L('2026-10-10', 'iFood', 100), L('2026-11-10', 'iFood', 250)];
  const v = e.visao(lancs, '2026-11');
  assert.equal(v.tarifas.total, 50);
  assert.equal(v.delivery.media, 100);
  assert.equal(v.delivery.acima, true);
  const so = e.delivery([L('2026-11-10', 'iFood', 90)], '2026-11');
  assert.equal(so.acima, null);
  assert.ok(so.lacuna);
});

test('KE4. sem documentos: lacuna, não "tudo certo"', () => {
  const v = e.visao([], '2026-11');
  assert.ok(v.lacunas.length === 1 && v.dicas.length === 0);
});

test('KE5. oportunidades respeitam horas, capital e habilidades, e nunca prometem renda', () => {
  const o = e.oportunidades({ habilidades: ['Programação', 'ensino'], horas_semana: 6, capital: 0 });
  const ids = o.map((x) => x.id);
  assert.ok(ids.includes('freelancer') && ids.includes('aulas') && ids.includes('vender_usados'));
  assert.ok(!ids.includes('entregas')); // pede 10 h
  assert.ok(!ids.includes('artesanato_comida')); // pede capital
  assert.ok(o.every((x) => /pode ser zero/.test(x.ganho) && x.investimento && x.tempo && x.risco));
  assert.ok(!/\bR\$|garant|ganhe/i.test(JSON.stringify(o.map((x) => x.ganho))));
});

function bancoFalso() {
  const dados = new Map();
  const col = (c) => ({ doc: (id) => ({ collection: (n) => col(`${c}/${id}/${n}`), set: async (v) => { dados.set(`${c}/${id}`, v); }, delete: async () => { dados.delete(`${c}/${id}`); }, get: async () => { const v = dados.get(`${c}/${id}`); return { exists: !!v, data: () => v }; } }),
    get: async () => ({ docs: [...dados.entries()].filter(([x]) => x.startsWith(c + '/') && !x.slice(c.length + 1).includes('/')).map(([x, v]) => ({ id: x.split('/').pop(), data: () => v })) }) });
  return { collection: col, dados };
}
test('KE6. API: perfil salvo, oportunidades com aviso; perfil inválido recusado', async () => {
  const banco = bancoFalso(); const antes = { db: p.deps.db, agora: p.deps.agora };
  p.deps.db = () => banco; p.deps.agora = () => new Date('2026-11-05T12:00:00Z');
  try {
    const vazio = (await p.agir('u1', { acao: 'econ_oportunidades' }))[1];
    assert.equal(vazio.perfil, null);
    assert.equal((await p.agir('u1', { acao: 'econ_perfil_salvar', horas_semana: 99, capital: 0 }))[0], 400);
    assert.equal((await p.agir('u1', { acao: 'econ_perfil_salvar', horas_semana: 8, capital: 500, habilidades: 'culinaria, design' }))[0], 200);
    const r = (await p.agir('u1', { acao: 'econ_oportunidades' }))[1];
    assert.ok(r.oportunidades.some((x) => x.id === 'artesanato_comida'));
    assert.match(r.aviso, /Não prometo renda/);
    const v = (await p.agir('u1', { acao: 'econ_visao' }))[1];
    assert.ok(v.lacunas.length);
  } finally { Object.assign(p.deps, antes); }
});
