'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { acessoDe, liberarAcesso, registrarAparelho, acoesAcesso } = require('../../netlify/functions/body-coach/acesso.js');
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

test('acesso: grátis, aviso nos últimos 5 dias e bloqueio quando acaba', async () => {
  const db = fakeDb();
  const t0 = Date.UTC(2026, 9, 1, 12);
  assert.equal((await acessoDe(db, 'ana', { email: 'ana@x.com' }, t0)).situacao, 'gratis');
  assert.equal((await acessoDe(db, 'ana', {}, t0 + 10 * DIA)).situacao, 'aviso');
  assert.equal((await acessoDe(db, 'ana', {}, t0 + 15 * DIA)).situacao, 'bloqueado');
  await liberarAcesso(db, 'ana', 30, t0 + 15 * DIA);
  assert.equal((await acessoDe(db, 'ana', {}, t0 + 16 * DIA)).situacao, 'pago');
});

test('acesso: admin e e-mails isentos nunca bloqueiam; aluno de coach pago fica liberado', async () => {
  const db = fakeDb();
  const longe = Date.now() + 400 * DIA;
  assert.equal((await acessoDe(db, 'adm', { email: 'gcbezerra@gmail.com' }, longe)).situacao, 'isento');
  assert.equal((await acessoDe(db, 'm', { master: true }, longe)).situacao, 'isento');
  await acoesAcesso({ acao: 'acesso_config', isentos: ['teste@x.com'], diasGratis: 10 }, 'adm', db, { master: true });
  assert.equal((await acessoDe(db, 't', { email: 'teste@x.com' }, longe)).situacao, 'isento');
  await acessoDe(db, 'coach', { papel: 'coach' }, Date.now());
  await liberarAcesso(db, 'coach', 365, Date.now(), { faixa: 15 });
  assert.equal((await acessoDe(db, 'bob', { coachUid: 'coach' }, Date.now() + 40 * DIA)).situacao, 'equipe');
  const [st] = await acoesAcesso({ acao: 'acesso_liberar', email: 'x@x.com', dias: 30 }, 'bob', db, {});
  assert.equal(st, 403);
});

test('acesso: no máximo 2 aparelhos; o mais antigo sai', async () => {
  const db = fakeDb();
  assert.equal((await registrarAparelho(db, 'u', 'A', 1)).sair, false);
  assert.equal((await registrarAparelho(db, 'u', 'B', 2)).sair, false);
  assert.equal((await registrarAparelho(db, 'u', 'C', 3)).sair, false);
  assert.equal((await registrarAparelho(db, 'u', 'A', 4)).sair, true);
  assert.equal((await registrarAparelho(db, 'u', 'B', 5)).sair, false);
});

test('chat: conta bloqueada recebe 402, mas ainda vê o acesso', async () => {
  const db = fakeDb();
  db.dados['bc_acesso'] = { zé: { inicio: 0, gratisAte: 1, pagoAte: 0, email: 'ze@x.com' } };
  const [st, out] = await executar({ acao: 'enviar', para: 'x', texto: 'oi' }, 'zé', db, {});
  assert.equal(st, 402);
  assert.equal(out.bloqueado, true);
  const [st2, ver] = await executar({ acao: 'acesso_ver', aparelho: 'A' }, 'zé', db, {});
  assert.equal(st2, 200);
  assert.equal(ver.situacao, 'bloqueado');
});

test('coach: nunca bloqueia; sem pagar cobre 3 alunos; Parceiro não cobre; aluno tem 7 dias quando o coach para', async () => {
  const db = fakeDb();
  const t0 = Date.UTC(2026, 9, 1, 12);
  assert.equal((await acessoDe(db, 'c', { papel: 'coach' }, t0)).limite, 9999); // teste de 30 dias
  const depois = t0 + 31 * DIA;
  const c = await acessoDe(db, 'c', { papel: 'coach' }, depois);
  assert.equal(c.situacao, 'basico');
  assert.equal(c.limite, 3);
  for (const a of ['a1', 'a2', 'a3']) assert.equal((await acessoDe(db, a, { coachUid: 'c' }, depois)).situacao, 'equipe');
  const quarto = await acessoDe(db, 'a4', { coachUid: 'c' }, depois);
  assert.notEqual(quarto.situacao, 'equipe'); // 4º aluno usa o próprio teste
  await liberarAcesso(db, 'c', 30, depois, { faixa: 15, valor: 49 });
  assert.equal((await acessoDe(db, 'a4', { coachUid: 'c' }, depois)).situacao, 'equipe');
  // coach venceu (60 dias depois): a4 perde a vaga, mas tem 7 dias de aviso
  const venceu = depois + 31 * DIA;
  const a4 = await acessoDe(db, 'a4', { coachUid: 'c' }, venceu);
  assert.equal(a4.situacao, 'bloqueado'); // a4 já tinha passado do próprio teste e da graça (cobertoAte = depois)
  db.dados['bc_acesso'].a1.cobertoAte = venceu - DIA;
  db.dados['bc_acesso'].c.plano = 'parceiro';
  const a1 = await acessoDe(db, 'a1', { coachUid: 'c' }, venceu);
  assert.equal(a1.situacao, 'aviso');
  assert.equal(a1.motivo, 'coach');
  const [st, plano] = await acoesAcesso({ acao: 'acesso_plano', plano: 'completo' }, 'c', db, {}, { papel: 'coach' });
  assert.equal(st, 200);
  assert.equal(plano.plano, 'completo');
});
