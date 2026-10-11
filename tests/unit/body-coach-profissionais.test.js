'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { executar } = require('../../netlify/functions/body-coach-chat.js');
const { telefoneLimpo, marcaLimpa } = require('../../netlify/functions/body-coach/profissionais.js');

// banco de mentira com where/orderBy/limit encadeados
function fakeDb() {
  const dados = {};
  let n = 0;
  const lista = (path) => Object.entries(dados[path] || {}).map(([id, d]) => ({ id, data: () => d }));
  const consulta = (path, filtros = [], ordem = null, lim = 1000) => ({
    where: (c, op, v) => consulta(path, [...filtros, [c, op, v]], ordem, lim),
    orderBy: (c, dir = 'asc') => consulta(path, filtros, [c, dir], lim),
    limit: (k) => consulta(path, filtros, ordem, k),
    get: async () => {
      let docs = lista(path).filter((d) => filtros.every(([c, op, v]) => (op === '==' ? d.data()[c] === v : op === '<' ? d.data()[c] < v : op === 'array-contains' ? (d.data()[c] || []).includes(v) : true)));
      if (ordem) docs = docs.sort((a, b) => (a.data()[ordem[0]] > b.data()[ordem[0]] ? 1 : -1) * (ordem[1] === 'desc' ? -1 : 1));
      return { docs: docs.slice(0, lim) };
    },
  });
  const col = (path) => ({
    ...consulta(path),
    doc: (id) => ({
      get: async () => ({ id, exists: !!(dados[path] || {})[id], data: () => (dados[path] || {})[id] }),
      set: async (v, o) => { (dados[path] ||= {})[id] = o && o.merge ? { ...((dados[path] || {})[id] || {}), ...v } : v; },
      delete: async () => { delete (dados[path] || {})[id]; },
      collection: (sub) => col(`${path}/${id}/${sub}`),
    }),
    add: async (v) => { const id = `m${++n}`; (dados[path] ||= {})[id] = v; return { id }; },
  });
  return { collection: col, dados };
}
async function montar() {
  const db = fakeDb();
  const [, c] = await executar({ acao: 'perfil', papel: 'coach', nome: 'Gil' }, 'coach1', db);
  const [, n] = await executar({ acao: 'perfil', papel: 'coach', nome: 'Dra. Lia' }, 'nutri1', db);
  await executar({ acao: 'perfil', papel: 'coach', nome: 'Outro' }, 'coach2', db);
  await executar({ acao: 'perfil', papel: 'aluno', nome: 'Ana' }, 'ana', db);
  await executar({ acao: 'vincular', codigo: c.perfil.codigo }, 'ana', db);
  return { db, codCoach: c.perfil.codigo, codNutri: n.perfil.codigo };
}
const ficha = { nome: 'A', dias: [{ titulo: 'A', exercicios: [{ nome: 'Supino', series: 3, reps: '10' }] }] };
const plano = { refeicoes: [{ nome: 'Café', itens: [{ nome: 'Ovo', qtd: '2' }] }] };

test('BCP1. nutricionista parceira: cada um edita só a sua parte, os dois conversam com o aluno', async () => {
  const { db, codNutri } = await montar();
  // pelo link do parceiro (?parte=dieta) quem já tem coach vira aluno da nutri como parceira, sem perder o coach
  const [st] = await executar({ acao: 'vincular', codigo: codNutri, parte: 'dieta' }, 'ana', db);
  assert.equal(st, 200);
  assert.equal(db.dados.bc_diretorio.ana.coachUid, 'coach1');
  assert.equal(db.dados.bc_diretorio.ana.parceiroUid, 'nutri1');
  const [, ct] = await executar({ acao: 'contatos' }, 'ana', db);
  assert.deepEqual(ct.contatos.map((x) => x.uid), ['coach1', 'nutri1']);
  // nutri: dieta sim, ficha não; coach: ficha sim, dieta não
  assert.equal((await executar({ acao: 'dieta_salvar', com: 'ana', plano }, 'nutri1', db))[0], 200);
  assert.equal((await executar({ acao: 'ficha_salvar', com: 'ana', ficha }, 'nutri1', db))[0], 403);
  assert.equal((await executar({ acao: 'ficha_salvar', com: 'ana', ficha }, 'coach1', db))[0], 200);
  assert.equal((await executar({ acao: 'dieta_salvar', com: 'ana', plano }, 'coach1', db))[0], 403);
  const [, pv] = await executar({ acao: 'prescricao_ver', com: 'ana' }, 'nutri1', db);
  assert.deepEqual(pv.pode, { ficha: false, dieta: true });
  assert.equal(pv.equipe.nome, 'Gil');
  // painel da nutri mostra a Ana como parceira; outro coach não conversa com ela
  const [, painel] = await executar({ acao: 'alunos_painel' }, 'nutri1', db);
  assert.equal(painel.alunos[0].vinculo, 'parceiro');
  assert.equal((await executar({ acao: 'enviar', com: 'ana', texto: 'Oi' }, 'nutri1', db))[0], 200);
  assert.equal((await executar({ acao: 'enviar', com: 'ana', texto: 'Oi' }, 'coach2', db))[0], 403);
  // aluno sai da parceria: coach volta a cuidar de tudo
  await executar({ acao: 'parceiro_sair' }, 'ana', db);
  assert.equal((await executar({ acao: 'dieta_salvar', com: 'ana', plano }, 'coach1', db))[0], 200);
  assert.equal((await executar({ acao: 'enviar', com: 'ana', texto: 'Oi' }, 'nutri1', db))[0], 403);
});

test('BCP2. convites da planilha: limpa, não repete e marca quem entrou pelo link', async () => {
  const { db, codCoach } = await montar();
  const [, r] = await executar({ acao: 'convites_importar', lista: [
    { nome: 'Bia', email: 'BIA@x.com', telefone: '(11) 98888-7777' },
    { nome: 'Caio', telefone: '21 3333-4444' },
    { nome: 'Bia de novo', email: 'bia@x.com' },
    { nome: 'Sem contato' },
  ] }, 'coach1', db);
  assert.deepEqual(r, { importados: 2, repetidos: 1, invalidos: 1 });
  const [, v] = await executar({ acao: 'convites_ver' }, 'coach1', db);
  const bia = v.convites.find((c) => c.nome === 'Bia');
  assert.equal(bia.telefone, '5511988887777');
  await executar({ acao: 'convite_enviado', ids: v.convites.map((c) => c.id), via: 'whatsapp' }, 'coach1', db);
  await executar({ acao: 'perfil', papel: 'aluno', nome: 'Bia' }, 'bia', db);
  await executar({ acao: 'vincular', codigo: codCoach, convite: bia.id }, 'bia', db);
  // Caio entra só com o código, mas a conta tem o e-mail? Não tem; fica pendente
  const [, v2] = await executar({ acao: 'convites_ver' }, 'coach1', db);
  assert.ok(v2.convites.find((c) => c.nome === 'Bia').entrou);
  assert.ok(v2.convites.every((c) => c.enviado));
  assert.equal(v2.convites.find((c) => c.nome === 'Caio').entrou, null);
  // aluno não importa nem vê convites
  assert.equal((await executar({ acao: 'convites_ver' }, 'ana', db))[0], 403);
});

test('BCP3. marca do coach chega no app do aluno; dados limpos', async () => {
  const { db } = await montar();
  assert.equal((await executar({ acao: 'marca_salvar', nome: 'Studio Gil', cor: 'azul', logo: 'data:image/png;base64,AAAA' }, 'coach1', db))[0], 200);
  const [, ct] = await executar({ acao: 'contatos' }, 'ana', db);
  assert.deepEqual(ct.marca, { nome: 'Studio Gil', cor: 'azul', logo: 'data:image/png;base64,AAAA' });
  assert.equal((await executar({ acao: 'marca_salvar', logo: 'javascript:alert(1)' }, 'coach1', db))[0], 400);
  assert.equal((await executar({ acao: 'marca_salvar', nome: 'X' }, 'ana', db))[0], 403);
  assert.deepEqual(marcaLimpa({ cor: 'neon' }), null);
  assert.equal(telefoneLimpo('+55 (21) 99999-0000'), '5521999990000');
  assert.equal(telefoneLimpo('123'), '');
});
