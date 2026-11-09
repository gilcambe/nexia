'use strict';
// Homologação Kernex Finance (#3267): bugs do dono que nunca podem voltar — soma de totais e ativo duplicado na lista.
// Cada teste é um caso de homologacao/catalogo/kernex-finance.json.
const test = require('node:test');
const assert = require('node:assert/strict');
const p = require('../../netlify/functions/prumo.js');
const { conferirTotais, chaveAtivo } = require('../../prumo/carteira.js');

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
  const banco = bancoFalso(); const antes = { db: p.deps.db, agora: p.deps.agora };
  let t = Date.parse('2026-11-09T10:00:00Z');
  p.deps.db = () => banco; p.deps.agora = () => new Date(t += 1000);
  try { return await fn(banco); } finally { Object.assign(p.deps, antes); }
}
const salvar = (it) => p.agir('u1', { acao: 'carteira_salvar', tipo: 'renda_fixa', data_valor: '2026-11-09', ...it });
const listar = async () => (await p.agir('u1', { acao: 'carteira_listar' }))[1].itens;
const soma = (l) => Math.round(l.reduce((a, x) => a + Number(x.valor), 0) * 100) / 100;

test('KF-001 total = soma exata das linhas, em centavos', () => {
  const itens = [{ valor: 0.1 }, { valor: 0.2 }, { valor: 1234.56 }, { valor: 999.99 }];
  const r = conferirTotais([{ total_print: 2234.85, itens: 4 }], itens, [false, false, false, false]);
  assert.equal(r[0].soma_itens, 2234.85); assert.equal(r[0].confere, true);
  const foto = p.fotoDoDia(itens.map((x, i) => ({ ...x, nome: 'A' + i, tipo: 'renda_fixa' })));
  assert.equal(Math.round(Number(foto.total) * 100) / 100, 2234.85, JSON.stringify(foto));
});

test('KF-002 soma dos grupos (tipo) = total geral', () => {
  const itens = [{ nome: 'a', tipo: 'renda_fixa', valor: 100.1 }, { nome: 'b', tipo: 'acoes', valor: 50.25 }, { nome: 'c', tipo: 'renda_fixa', valor: 0.65 }];
  const foto = p.fotoDoDia(itens);
  const grupos = foto.por_tipo || foto.porTipo || foto.tipos;
  if (grupos) assert.equal(Math.round(Object.values(grupos).reduce((a, v) => a + Number(v.valor ?? v), 0) * 100) / 100, Number(foto.total));
  assert.equal(Number(foto.total), 151);
});

test('KF-003 mesmo ativo em 2 prints (rolagem) salva 1 vez só', () => comBanco(async () => {
  await salvar({ nome: 'CDB LIQUIDEZ DIARIA', banco: 'Inter', valor: 1000 });
  await salvar({ nome: 'CDB LIQUIDEZ DIARIA', banco: 'Inter', valor: 1000 });
  const l = await listar(); assert.equal(l.length, 1); assert.equal(soma(l), 1000);
}));

test('KF-004 mesmo ativo escrito diferente (caixa, acento, "do", hífen, S.A.) é o mesmo', () => comBanco(async () => {
  await salvar({ nome: 'CDB BANCO X 120% CDI', banco: 'Banco Inter S.A.', valor: 500 });
  await salvar({ nome: 'CDB Banco X - 120% do CDI', banco: 'banco inter', valor: 510 });
  await salvar({ nome: 'cdb banco x 120% cdi', banco: 'Banco Inter', valor: 520 });
  const l = await listar(); assert.equal(l.length, 1, JSON.stringify(l)); assert.equal(soma(l), 520, 'fica o valor mais novo');
  assert.equal(chaveAtivo({ nome: 'Tesouro Selic 2029', banco: 'Ágora' }), chaveAtivo({ nome: 'TESOURO SELIC 2029', banco: 'agora' }));
}));

test('KF-005 importar o MESMO print 2 vezes não dobra o valor', () => comBanco(async () => {
  const print = [{ nome: 'MXRF11', ticker: 'MXRF11', banco: 'XP', tipo: 'fiis', valor: 100 }, { nome: 'HGLG11', ticker: 'HGLG11', banco: 'XP', tipo: 'fiis', valor: 200 }];
  for (let i = 0; i < 2; i++) for (const it of print) await salvar(it);
  const l = await listar(); assert.equal(l.length, 2); assert.equal(soma(l), 300);
}));

test('KF-006 ativos diferentes de nome parecido continuam separados', () => comBanco(async () => {
  await salvar({ nome: 'CDB Banco X 2027', banco: 'Inter', valor: 100 });
  await salvar({ nome: 'CDB Banco X 2028', banco: 'Inter', valor: 200 });
  await salvar({ nome: 'CDB Banco X 2027', banco: 'Nubank', valor: 300 });
  assert.equal((await listar()).length, 3);
}));

test('KF-007 título de grupo com subtotal nunca vira ativo', () => {
  const r = p.tirarSubtotais([{ nome: 'Renda Fixa', valor: 300 }, { nome: 'CDB A', valor: 100 }, { nome: 'CDB B', valor: 200 }]);
  assert.deepEqual(r.map((x) => x.nome), ['CDB A', 'CDB B']);
});

test('KF-008 duplicados já gravados: a lista mostra 1 e apagar faz o total cair exatamente o valor', () => comBanco(async (banco) => {
  // Situação do dono: o mesmo ativo gravado 2 vezes antes da correção.
  banco.dados.set('prumo_users/u1/carteira/a1', { nome: 'PETR4', ticker: 'PETR4', banco: 'XP', tipo: 'acoes', valor: 400, atualizado_em: '2026-11-01T00:00:00Z' });
  banco.dados.set('prumo_users/u1/carteira/a2', { nome: 'PETR4', ticker: 'PETR4', banco: 'XP', tipo: 'acoes', valor: 410, atualizado_em: '2026-11-02T00:00:00Z' });
  banco.dados.set('prumo_users/u1/carteira/b1', { nome: 'CDB', banco: 'Inter', tipo: 'renda_fixa', valor: 1000, atualizado_em: '2026-11-01T00:00:00Z' });
  let l = await listar(); assert.equal(l.length, 2); assert.equal(soma(l), 1410);
  const petr = l.find((x) => x.ticker === 'PETR4'); assert.equal(petr.valor, 410);
  await p.agir('u1', { acao: 'carteira_apagar', id: petr.id });
  l = await listar(); assert.equal(l.length, 1); assert.equal(soma(l), 1000);
}));

test('KF-009 salvar de novo depois de recarregar: mesma lista e mesmo total', () => comBanco(async () => {
  await salvar({ nome: 'Poupança', banco: 'Caixa', tipo: 'poupanca', valor: 80 });
  const a = await listar();
  await salvar({ nome: 'Poupança', banco: 'Caixa', tipo: 'poupanca', valor: 80 });
  const b = await listar(); assert.deepEqual(b.map((x) => x.id), a.map((x) => x.id)); assert.equal(soma(b), 80);
}));

test('KF-010 a chave do app (tela) e a do servidor são iguais', () => {
  const casos = [{ nome: 'CDB Banco X - 120% do CDI', banco: 'Banco Inter S.A.' }, { ticker: 'MXRF11', nome: 'x', banco: 'XP' }, { nome: 'Tesouro IPCA+ 2035', banco: 'Ágora Ltda' }];
  for (const c of casos) assert.equal(chaveAtivo(c), p.chaveAtivo(c));
});
