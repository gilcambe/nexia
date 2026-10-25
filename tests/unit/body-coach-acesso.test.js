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

test('acesso: grátis (7 dias), aviso nos últimos 3 dias, aviso de pagamento por Pix e liberação do plano', async () => {
  const db = fakeDb();
  const t0 = Date.UTC(2026, 9, 1, 12);
  // Novo cadastro: 7 dias do plano Pro/Premium grátis
  assert.equal((await acessoDe(db, 'ana', { email: 'ana@x.com' }, t0)).situacao, 'gratis');
  // Faltando 3 dias ou menos (dia 4 em diante): situacao 'aviso'
  assert.equal((await acessoDe(db, 'ana', {}, t0 + 4 * DIA)).situacao, 'aviso');
  // Ao expirar (7 dias depois): 'bloqueado'
  assert.equal((await acessoDe(db, 'ana', {}, t0 + 7 * DIA)).situacao, 'bloqueado');

  // Cliente clica "Já paguei" no app
  const [stPaguei] = await acoesAcesso({ acao: 'acesso_paguei', plano: 'mensal', valor: 19.9 }, 'ana', db, { email: 'ana@x.com' });
  assert.equal(stPaguei, 200);

  // Pedido registrado para o dono confirmar
  assert.equal(Object.values(db.dados.bc_acesso_pedidos).length, 1);
  assert.equal(Object.values(db.dados.bc_acesso_pedidos)[0].uid, 'ana');

  // Dono confirma Pix e libera 30 dias de acesso ativo
  await liberarAcesso(db, 'ana', 30, t0 + 7 * DIA);
  assert.equal((await acessoDe(db, 'ana', {}, t0 + 8 * DIA)).situacao, 'pago');
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

test('acesso: dono_presente libera plano e marca presente: true se existe, ou 404 se não existe', async () => {
  const db = fakeDb();
  // Sem conta
  const [st404] = await acoesAcesso({ acao: 'dono_presente', email: 'inexistente@x.com', dias: 30 }, 'adm', db, { master: true });
  assert.equal(st404, 404);

  // Com conta
  db.dados['bc_acesso'] = { user123: { email: 'contapresente@x.com', inicio: Date.now() } };
  const [st200, res] = await acoesAcesso({ acao: 'dono_presente', email: 'contapresente@x.com', dias: 45 }, 'adm', db, { master: true });
  assert.equal(st200, 200);
  assert.equal(res.ok, true);
  assert.equal(res.uid, 'user123');
  assert.equal(db.dados['bc_acesso']['user123'].presente, true);
  assert.ok(db.dados['bc_acesso']['user123'].pagoAte > Date.now());
});

test('painel do dono: resumo, uso diário, cupom e promoção', async () => {
  const db = fakeDb();
  const agora = Date.now();
  db.dados.bc_acesso = {
    c1: { tipo: 'coach', inicio: agora, pagoAte: agora + 3 * DIA },
    i1: { tipo: 'independente', inicio: agora, gratisAte: agora + 10 * DIA },
    a1: { tipo: 'aluno', inicio: agora },
  };
  const mes = new Date(agora - 3 * 3600000).toISOString().slice(0, 7);
  db.dados.bc_acesso_pagamentos = { p: { mes, valor: 19.9 } };
  await acoesAcesso({ acao: 'acesso_ver', aparelho: 'x1' }, 'i1', db, {});
  await acoesAcesso({ acao: 'acesso_ver', aparelho: 'x1' }, 'i1', db, {});
  await acoesAcesso({ acao: 'acesso_ver', aparelho: 'x2' }, 'novo', db, {}); // conta nova: independente em teste
  const [st, r] = await acoesAcesso({ acao: 'dono_resumo' }, 'adm', db, { master: true });
  assert.equal(st, 200);
  assert.equal(r.total, 4);
  assert.deepEqual(r.porTipo, { coach: 1, aluno: 1, independente: 2 });
  assert.equal(r.pagantes, 1);
  assert.equal(r.emTeste, 2);
  assert.equal(r.vencendo7, 1);
  assert.equal(r.receitaMes, 19.9);
  assert.equal(r.ativosPorDia[29].n, 2);
  assert.equal((await acoesAcesso({ acao: 'dono_resumo' }, 'i1', db, {}))[0], 403);

  assert.equal((await acoesAcesso({ acao: 'cupom_criar', codigo: 'volta20', pct: 20, dias: 10, maxUsos: 1 }, 'adm', db, { master: true }))[0], 200);
  assert.equal((await acoesAcesso({ acao: 'cupom_criar', codigo: 'x', pct: 20 }, 'i1', db, {}))[0], 403);
  const [stc, c] = await acoesAcesso({ acao: 'cupom_ver', codigo: 'VOLTA20' }, 'i1', db, {});
  assert.equal(stc, 200);
  assert.equal(c.pct, 20);
  await acoesAcesso({ acao: 'acesso_paguei', cupom: 'volta20' }, 'i1', db, { email: 'i@x.com' });
  assert.equal((await acoesAcesso({ acao: 'cupom_ver', codigo: 'VOLTA20' }, 'i1', db, {}))[0], 404); // 1 uso só
  assert.equal((await acoesAcesso({ acao: 'cupom_ver', codigo: 'NADA' }, 'i1', db, {}))[0], 404);

  await acoesAcesso({ acao: 'promo_salvar', pct: 30, ate: agora + DIA, texto: 'Semana fit' }, 'adm', db, { master: true });
  const [, ver] = await acoesAcesso({ acao: 'acesso_ver', aparelho: 'x1' }, 'i1', db, {});
  assert.equal(ver.promo.pct, 30);
  await acoesAcesso({ acao: 'promo_salvar', pct: 0 }, 'adm', db, { master: true });
  assert.equal((await acoesAcesso({ acao: 'acesso_ver', aparelho: 'x1' }, 'i1', db, {}))[1].promo, undefined);
});

test('acesso: regras salvam chave Pix e nome de quem recebe; quem paga vê os dois', async () => {
  const db = fakeDb();
  const [st] = await acoesAcesso({ acao: 'acesso_config', pix: '123.456.789-00', pixNome: ' GILDIVAN CAMILO BEZERRA ' }, 'adm', db, { master: true });
  assert.equal(st, 200);
  const a = await acessoDe(db, 'ana', { email: 'ana@x.com' }, Date.now());
  assert.equal(a.pix, '123.456.789-00');
  assert.equal(a.pixNome, 'GILDIVAN CAMILO BEZERRA');
  await acoesAcesso({ acao: 'acesso_config', diasGratis: 20 }, 'adm', db, { master: true });
  assert.equal((await acessoDe(db, 'ana', {}, Date.now())).pixNome, 'GILDIVAN CAMILO BEZERRA');
});
