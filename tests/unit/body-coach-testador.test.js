'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { acessoDe, acoesAcesso, DIAS_TESTADOR } = require('../../netlify/functions/body-coach/acesso.js');
const { executar } = require('../../netlify/functions/body-coach-chat.js');

// banco de mentira em memória (só o que as funções usam)
function fakeDb() {
  const dados = {};
  let n = 0;
  const lista = (path) => Object.entries(dados[path] || {}).map(([id, d]) => ({ id, data: () => d }));
  const col = (path) => ({
    doc: (id) => ({
      get: async () => ({ id, exists: !!(dados[path] || {})[id], data: () => (dados[path] || {})[id] }),
      set: async (v, o) => { (dados[path] ||= {})[id] = o && o.merge ? { ...((dados[path] || {})[id] || {}), ...v } : v; },
    }),
    add: async (v) => { const id = `p${++n}`; (dados[path] ||= {})[id] = v; return { id }; },
    where: (campo, op, val) => ({ limit: () => ({ get: async () => ({ docs: lista(path).filter((d) => d.data()[campo] === val) }) }) }),
    orderBy: () => ({ limit: (k) => ({ get: async () => ({ docs: lista(path).slice(0, k) }) }) }),
  });
  return { collection: col, dados };
}
const DIA = 86400000;

test('testador: ganha 30 dias de Premium uma vez só, mesmo com o acesso bloqueado', async () => {
  const db = fakeDb();
  db.dados['bc_acesso'] = { ana: { inicio: 0, gratisAte: 1, pagoAte: 0, email: 'ana@gmail.com' } };
  assert.equal((await acessoDe(db, 'ana', {})).situacao, 'bloqueado');

  const [st, out] = await executar({ acao: 'acesso_testador' }, 'ana', db, { email: 'Ana@Gmail.com' });
  assert.equal(st, 200);
  assert.equal(out.jaGanhou, false);
  assert.equal(out.dias, DIAS_TESTADOR);
  assert.ok(out.pagoAte > Date.now() + 29 * DIA);
  const reg = db.dados['bc_testadores'].ana;
  assert.equal(reg.email, 'ana@gmail.com');
  assert.match(reg.dia, /^\d{4}-\d{2}-\d{2}$/);
  const ac = await acessoDe(db, 'ana', {});
  assert.equal(ac.situacao, 'pago');
  assert.equal(ac.testador, true);

  // segundo clique: não soma mais dias
  const [st2, out2] = await executar({ acao: 'acesso_testador' }, 'ana', db, { email: 'ana@gmail.com' });
  assert.equal(st2, 200);
  assert.equal(out2.jaGanhou, true);
  assert.equal(db.dados['bc_acesso'].ana.pagoAte, out.pagoAte);
});

test('testador: só o admin vê a lista de testadores', async () => {
  const db = fakeDb();
  await acoesAcesso({ acao: 'acesso_testador' }, 'bob', db, { email: 'bob@gmail.com' }, { nome: 'Bob' });
  const [negado] = await acoesAcesso({ acao: 'acesso_testadores' }, 'bob', db, { email: 'bob@gmail.com' });
  assert.equal(negado, 403);
  const [st, out] = await acoesAcesso({ acao: 'acesso_testadores' }, 'adm', db, { master: true });
  assert.equal(st, 200);
  assert.equal(out.testadores.length, 1);
  assert.equal(out.testadores[0].email, 'bob@gmail.com');
  assert.equal(out.testadores[0].nome, 'Bob');
});
