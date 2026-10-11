'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { executar } = require('../../netlify/functions/body-coach-chat.js');
const { rodarCobrancas } = require('../../netlify/functions/body-coach/negocio.js');

// banco de mentira em memória (só o que as funções usam)
function fakeDb() {
  const dados = {};
  let n = 0;
  const lista = (path) => Object.entries(dados[path] || {}).map(([id, d]) => ({ id, data: () => d }));
  const col = (path) => ({
    doc: (id) => ({
      get: async () => ({ id, exists: !!(dados[path] || {})[id], data: () => (dados[path] || {})[id] }),
      set: async (v, o) => { (dados[path] ||= {})[id] = o && o.merge ? { ...((dados[path] || {})[id] || {}), ...v } : v; },
      delete: async () => { delete (dados[path] || {})[id]; },
      collection: (sub) => col(`${path}/${id}/${sub}`),
    }),
    add: async (v) => { const id = `m${++n}`; (dados[path] ||= {})[id] = v; return { id }; },
    where: (campo, op, val) => ({ limit: () => ({ get: async () => ({ docs: lista(path).filter((d) => d.data()[campo] === val) }) }) }),
    orderBy: (campo) => ({ limit: (k) => ({ get: async () => ({ docs: lista(path).sort((a, b) => String(b.data()[campo]).localeCompare(String(a.data()[campo]))).slice(0, k) }) }) }),
  });
  return { collection: col, dados };
}
const msgs = (db, a, b) => Object.values(db.dados[`bc_conversas/${[a, b].sort().join('__')}/mensagens`] || {});
const PIX = { acao: 'pix_config', tipo: 'cpf', chave: '12345678909', nome: 'Gil Coach', cidade: 'Recife', valor: 150, vencimento: 10 };

async function montar() {
  const db = fakeDb();
  const [, c] = await executar({ acao: 'perfil', papel: 'coach', nome: 'Gil' }, 'coach1', db);
  for (const [id, nome] of [['ana', 'Ana'], ['bob', 'Bob']]) {
    await executar({ acao: 'perfil', papel: 'aluno', nome }, id, db);
    await executar({ acao: 'vincular', codigo: c.perfil.codigo }, id, db);
  }
  await executar(PIX, 'coach1', db);
  return { db, codigo: c.perfil.codigo };
}
const mesBR = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 7);

test('BCN1. financeiro: 12 meses, recebido por mês, quem falta e valor próprio do aluno', async () => {
  const { db } = await montar();
  const mes = mesBR();
  await executar({ acao: 'pagamento_marcar', aluno: 'ana', mes, pago: true, valor: 200 }, 'coach1', db);
  const [y, m] = mes.split('-').map(Number);
  const antes = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  await executar({ acao: 'pagamento_marcar', aluno: 'bob', mes: antes, pago: true }, 'coach1', db);
  assert.equal((await executar({ acao: 'financeiro_ver' }, 'ana', db))[0], 403);
  const [s, f] = await executar({ acao: 'financeiro_ver' }, 'coach1', db);
  assert.equal(s, 200);
  assert.equal(f.historico.length, 12);
  assert.equal(f.historico.at(-1).mensalidades, 200);
  assert.equal(f.historico.at(-2).mensalidades, 150);
  assert.equal(f.previsto, 350);
  assert.equal(f.alunos[0].nome, 'Bob', 'quem não pagou vem primeiro');
  assert.equal(f.alunos[0].pago, false);
});

test('BCN2. cobrar: manual (um e todos) e automático 3 dias antes, no dia e 3 depois; nunca 2x no dia', async () => {
  const { db } = await montar();
  const [, r] = await executar({ acao: 'pagamento_lembrar', aluno: 'bob' }, 'coach1', db);
  assert.equal(r.lembrados, 1);
  assert.match(msgs(db, 'bob', 'coach1').at(-1).texto, /mensalidade de R\$ 150,00/);
  await executar({ acao: 'pagamento_marcar', aluno: 'ana', mes: mesBR(), pago: true }, 'coach1', db);
  assert.equal((await executar({ acao: 'pagamento_lembrar', todos: true }, 'coach1', db))[1].lembrados, 1, 'quem pagou não é cobrado');
  // automático: dia 7 (3 antes do dia 10), dia 10, dia 13 — e não no dia 8
  const dia = (d) => Date.parse(`${mesBR()}-${String(d).padStart(2, '0')}T12:00:00-03:00`);
  db.dados.bc_diretorio.bob.lembreteMensalidade = '';
  assert.equal((await rodarCobrancas(db, dia(8))).lembrados, 0);
  assert.equal((await rodarCobrancas(db, dia(7))).lembrados, 1);
  assert.equal((await rodarCobrancas(db, dia(7))).lembrados, 0, 'não repete no mesmo dia');
  assert.match(msgs(db, 'bob', 'coach1').at(-1).texto, /Lembrete automático: sua mensalidade de R\$ 150,00 vence dia 10/);
  assert.equal((await rodarCobrancas(db, dia(10))).lembrados, 1);
  assert.equal((await rodarCobrancas(db, dia(13))).lembrados, 1);
  assert.match(msgs(db, 'bob', 'coach1').at(-1).texto, /venceu dia 10/);
  // coach desliga o automático
  await executar({ ...PIX, lembrete: false }, 'coach1', db);
  assert.equal((await rodarCobrancas(db, dia(14 - 1))).lembrados, 0);
  // pendências do aluno (para o Hoje)
  const [, pend] = await executar({ acao: 'aluno_pendencias' }, 'bob', db);
  assert.equal(pend.coach, 'Gil');
});

test('BCN3. programa à venda: loja pública, compra por Pix, coach confirma e o comprador recebe ficha e dieta e entra na equipe', async () => {
  const { db, codigo } = await montar();
  const FICHA = { nome: 'X', dias: [{ titulo: 'A', exercicios: [{ id: 'supino_reto', nome: 'Supino reto', grupo: 'peito', series: 3, reps: '10', descanso: 90 }] }] };
  const [, mf] = await executar({ acao: 'modelo_salvar', tipo: 'ficha', dados: FICHA, nome: 'Base' }, 'coach1', db);
  const [, md] = await executar({ acao: 'modelo_salvar', tipo: 'dieta', dados: { refeicoes: [{ nome: 'Café', itens: [{ nome: 'Ovos', qtd: '2' }] }] }, nome: 'D' }, 'coach1', db);
  assert.equal((await executar({ acao: 'programa_salvar', titulo: 'Verão 8 semanas', preco: 0, ficha: mf.id }, 'coach1', db))[0], 400);
  assert.equal((await executar({ acao: 'programa_salvar', titulo: 'Verão 8 semanas', preco: 97, ficha: md.id }, 'coach1', db))[0], 400, 'ficha tem que ser modelo de ficha');
  const [s, p] = await executar({ acao: 'programa_salvar', titulo: 'Verão 8 semanas', descricao: 'Treino + dieta', preco: 97, semanas: 8, ficha: mf.id, dieta: md.id }, 'coach1', db);
  assert.equal(s, 200);
  const { lojaVer } = require('../../netlify/functions/body-coach-chat.js');
  const [sl, loja] = await lojaVer({ codigo }, db);
  assert.equal(sl, 200);
  assert.deepEqual({ n: loja.coach.nome, t: loja.programas[0].titulo, p: loja.programas[0].preco, d: loja.programas[0].temDieta }, { n: 'Gil', t: 'Verão 8 semanas', p: 97, d: true });
  assert.equal(loja.programas[0].resumo, '1 treino · 1 exercícios');
  assert.equal((await lojaVer({ codigo: 'ZZZZZZ' }, db))[0], 404);
  // comprador novo (nem escolheu aluno/coach ainda)
  await db.collection('bodycoach_users').doc('caio').collection('profile').doc('main').set({ full_name: 'Caio Lima' });
  const [sc, c] = await executar({ acao: 'compra_criar', programa: p.id }, 'caio', db);
  assert.equal(sc, 200);
  assert.equal(c.compra.nome, 'Caio Lima');
  assert.equal(c.pix.chave, '12345678909');
  assert.equal(c.compra.preco, 97);
  assert.equal((await executar({ acao: 'compra_criar', programa: p.id }, 'caio', db))[1].compra.id, c.compra.id, 'não duplica a compra aberta');
  assert.equal((await executar({ acao: 'compra_criar', programa: p.id }, 'coach1', db))[0], 400);
  await executar({ acao: 'compra_avisar', id: c.compra.id }, 'caio', db);
  const [, fin] = await executar({ acao: 'financeiro_ver' }, 'coach1', db);
  assert.equal(fin.vendas[0].status, 'avisou');
  assert.equal((await executar({ acao: 'compra_confirmar', id: c.compra.id, ok: true }, 'ana', db))[0], 403);
  const [sk] = await executar({ acao: 'compra_confirmar', id: c.compra.id, ok: true }, 'coach1', db);
  assert.equal(sk, 200);
  const caio = db.dados.bc_diretorio.caio;
  assert.equal(caio.coachUid, 'coach1');
  assert.equal(caio.papel, 'aluno');
  const perfil = db.dados['bodycoach_users/caio/profile'].main;
  assert.equal(perfil.ficha_coach.nome, 'Verão 8 semanas');
  assert.equal(perfil.plano_nutri.do_coach, true);
  assert.match(msgs(db, 'caio', 'coach1').at(-1).texto, /Pagamento confirmado/);
  const [, fin2] = await executar({ acao: 'financeiro_ver' }, 'coach1', db);
  assert.equal(fin2.historico.at(-1).vendas, 97);
  assert.equal((await executar({ acao: 'compra_confirmar', id: c.compra.id, ok: true }, 'coach1', db))[0], 409);
  assert.equal((await executar({ acao: 'compras_minhas' }, 'caio', db))[1].compras[0].status, 'pago');
  // aluno de outro coach não compra
  await executar({ acao: 'perfil', papel: 'coach', nome: 'Outro' }, 'coach2', db);
  const [, p2] = await executar({ acao: 'programa_salvar', titulo: 'Outro prog', preco: 50, ficha: mf.id }, 'coach2', db);
  assert.ok(p2.error, 'modelo de outro coach não serve');
});
