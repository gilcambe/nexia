'use strict';
// Kernex Finance, fase 12: família com permissões e autônomo PF × PJ.
const test = require('node:test');
const assert = require('node:assert/strict');
const p = require('../../netlify/functions/prumo.js');
const f = require('../../netlify/functions/prumo-lib/familia');

function bancoFalso() {
  const dados = new Map();
  const col = (c) => ({ doc: (id) => ({ collection: (n) => col(`${c}/${id}/${n}`), set: async (v) => { dados.set(`${c}/${id}`, JSON.parse(JSON.stringify(v))); }, delete: async () => { dados.delete(`${c}/${id}`); }, get: async () => { const v = dados.get(`${c}/${id}`); return { exists: !!v, data: () => v && JSON.parse(JSON.stringify(v)) }; } }),
    get: async () => ({ docs: [...dados.entries()].filter(([x]) => x.startsWith(c + '/') && !x.slice(c.length + 1).includes('/')).map(([x, v]) => ({ id: x.split('/').pop(), data: () => v })) }) });
  return { collection: col, dados };
}
async function comBanco(fn) {
  const banco = bancoFalso(); const antes = { db: p.deps.db, agora: p.deps.agora };
  p.deps.db = () => banco; p.deps.agora = () => new Date('2026-11-05T12:00:00Z');
  try { await fn(banco); } finally { Object.assign(p.deps, antes); }
}
const lanc = (id, tipo, valor, perfil, extra = {}) => ({ acao: 'doc_confirmar', lancamentos: [{ data: '2026-11-03', descricao: id, estabelecimento: id, valor, tipo, categoria: 'outros', perfil, ...extra }] });

test('KF1. membro não vê o que não foi compartilhado; só vê as seções marcadas', async () => {
  await comBanco(async () => {
    await p.agir('ana', lanc('Salário Ana', 'receita', 5000, 'pf'));
    await p.agir('ana', lanc('Mercado Ana', 'despesa', 800, 'pf'));
    await p.agir('ana', { acao: 'divida_salvar', credor: 'Banco', tipo: 'emprestimo', saldo: 3000, juros_mes: 2, parcela: 200 });
    const criada = (await p.agir('ana', { acao: 'familia_criar', nome: 'Casa' }))[1];
    assert.ok(criada.familia_id);
    const conv = (await p.agir('ana', { acao: 'familia_convidar' }))[1];
    assert.equal((await p.agir('beto', { acao: 'familia_entrar', codigo: 'ERRADO' }))[0], 400);
    assert.equal((await p.agir('beto', { acao: 'familia_entrar', codigo: conv.codigo }))[0], 200);
    assert.equal((await p.agir('carla', { acao: 'familia_entrar', codigo: conv.codigo }))[0], 400); // código de uso único
    let v = (await p.agir('beto', { acao: 'familia_ver' }))[1];
    assert.equal(v.membros.length, 1);
    assert.equal(v.membros[0].dados, null); // Ana não compartilhou nada
    assert.ok(!JSON.stringify(v).includes('5000') && !JSON.stringify(v).includes('Salário'));
    await p.agir('ana', { acao: 'familia_compartilhar', secoes: ['resumo_mes'] });
    v = (await p.agir('beto', { acao: 'familia_ver' }))[1];
    assert.equal(v.membros[0].dados.resumo_mes.receitas, 5000);
    assert.equal(v.membros[0].dados.dividas, undefined); // dívida segue privada
    assert.equal(v.membros[0].dados.patrimonio, undefined);
    assert.ok(!JSON.stringify(v).includes('Banco'));
    // quem não é do grupo não vê nada
    assert.equal((await p.agir('intruso', { acao: 'familia_ver' }))[0], 400);
  });
});

test('KF2. dono só sai depois dos outros; ao sair, o compartilhamento é desligado', async () => {
  await comBanco(async () => {
    await p.agir('ana', { acao: 'familia_criar' });
    const conv = (await p.agir('ana', { acao: 'familia_convidar' }))[1];
    await p.agir('beto', { acao: 'familia_entrar', codigo: conv.codigo });
    await p.agir('beto', { acao: 'familia_compartilhar', secoes: ['patrimonio'] });
    assert.equal((await p.agir('ana', { acao: 'familia_sair' }))[0], 400);
    assert.equal((await p.agir('beto', { acao: 'familia_sair' }))[0], 200);
    const est = (await p.agir('beto', { acao: 'familia_estado' }))[1];
    assert.equal(est.em_familia, false);
    assert.deepEqual(est.compartilhando, []);
  });
});

test('KF3. PF e PJ não se misturam nos totais (resumo pessoal, lista e autônomo)', async () => {
  await comBanco(async () => {
    await p.agir('u1', lanc('Salário', 'receita', 4000, 'pf'));
    await p.agir('u1', lanc('Mercado', 'despesa', 500, 'pf'));
    await p.agir('u1', lanc('Cliente X', 'receita', 10000, 'pj'));
    await p.agir('u1', lanc('Contador', 'despesa', 300, 'pj'));
    const ini = (await p.agir('u1', { acao: 'inicio_resumo' }))[1];
    assert.equal(ini.receitas, 4000);
    assert.equal(ini.despesas, 500);
    const lp = (await p.agir('u1', { acao: 'lanc_listar' }))[1];
    assert.equal(lp.receitas, 4000);
    const lj = (await p.agir('u1', { acao: 'lanc_listar', perfil: 'pj' }))[1];
    assert.equal(lj.receitas, 10000);
    const a = (await p.agir('u1', { acao: 'autonomo_resumo', aliquota_pct: 6 }))[1];
    assert.equal(a.pj.lucro, 9700);
    assert.equal(a.pj.imposto_estimado, 600);
    assert.equal(a.pf.economia, 3500);
    const sem = (await p.agir('u1', { acao: 'autonomo_resumo' }))[1];
    assert.equal(sem.pj.imposto_estimado, null); // não presume alíquota
    assert.equal((await p.agir('u1', { acao: 'autonomo_resumo', aliquota_pct: 200 }))[0], 400);
  });
});

test('KF4. resumoAutonomo: lançamento sem perfil conta como pessoal', () => {
  const r = f.resumoAutonomo([{ data: '2026-11-01', tipo: 'receita', valor: 100 }, { data: '2026-11-01', tipo: 'receita', valor: 900, perfil: 'pj' }], '2026-11', null);
  assert.equal(r.pf.receitas, 100);
  assert.equal(r.pj.receitas, 900);
});
