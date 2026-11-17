'use strict';
// Contrato: Kernex Finance — robôs de investimento, parte 2a de 3: a API.
// A parte 1 (#3851) criou o "cérebro" em netlify/functions/prumo-lib/robos.js: validarRegra e avaliarRegras.
// Agora a pessoa precisa guardar os robôs, ver a lista, apagar e mandar conferir agora.
//
// Pedido: em robos.js, nova função exportada  agirRobos(acao, body, c)  (mesmo formato de agirAlertas/agirCotacoes):
//   devolve null se a ação não for de robô; senão [status, corpo]. Ações:
//   - 'robos_salvar'  -> valida com validarRegra(body) e grava com c.salvar('robos', valid)  (400 com o erro se inválido)
//   - 'robos_listar'  -> [200, { robos: [...coleção 'robos'], disparos: [...últimos 20 da coleção 'robos_disparos', mais novo primeiro] }]
//   - 'robos_apagar'  -> c.apagar('robos')
//   - 'robos_checar'  -> pega a carteira (c.listarCarteira()), chama require('./cotacoes').carteiraAoVivo(itens, { fetch, agora, env })
//                        NA HORA (não desestruture no topo do arquivo), põe em viva.assessor.alocacao_alvo o alvo salvo em
//                        config/alocacao (campo "alvo"; null se não houver), roda avaliarRegras(robos, viva, c.agoraIso) e,
//                        para cada disparo: grava ultimo_disparo = data de hoje em Brasília (AAAA-MM-DD) no robô e guarda o
//                        disparo na coleção 'robos_disparos' ({ ...disparo, em: c.agoraIso }).
//                        Devolve [200, { disparos, lacunas }].
//   E em prumo-lib/extra.js, dentro de agirExtra, chame agirRobos como as outras (se devolver algo, retorne).
// ATENÇÃO (defeito da parte 1): validarRegra devolve o item SEM o campo "tipo"; o robô salvo nunca dispara.
// Corrija: o item devolvido por validarRegra precisa ter tipo.
// Data de Brasília: Brasília é UTC-3 o ano todo; use new Date(Date.parse(iso) - 3 * 3600 * 1000).toISOString().slice(0, 10)
// (sem getTimezoneOffset, que muda com o fuso da máquina).
const test = require('node:test');
const assert = require('node:assert/strict');
const p = require('../../netlify/functions/prumo.js');
const cotacoes = require('../../netlify/functions/prumo-lib/cotacoes');

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
const U = 'prumo_users/u1';
const doc = (b, k) => b.dados.get(`${U}/${k}`);

function preparar(agora = '2026-11-17T17:00:00.000Z') { // 14h em Brasília
  const banco = bancoFalso();
  p.deps.db = () => banco;
  p.deps.agora = () => new Date(agora);
  const chamadas = [];
  cotacoes.carteiraAoVivo = async (itens, op) => {
    chamadas.push({ itens, op });
    return {
      itens: [{ id: 'a', ticker: 'PETR4', vivo: { preco: 30, variacao_dia_pct: -5, valor: 300 }, proventos: null }],
      total: 1000, por_tipo: { acoes: 300, renda_fixa: 700 }, assessor: {},
    };
  };
  return { banco, chamadas };
}

test('robos_salvar valida e grava; inválido volta 400 com frase', async () => {
  const { banco } = preparar();
  const ok = await p.agir('u1', { acao: 'robos_salvar', tipo: 'preco_abaixo', ticker: 'petr4', valor: 35 });
  assert.equal(ok[0], 200);
  assert.ok(ok[1].id);
  assert.equal(doc(banco, `robos/${ok[1].id}`).ticker, 'PETR4');
  assert.equal(doc(banco, `robos/${ok[1].id}`).tipo, 'preco_abaixo', 'o robô salvo guarda o tipo (sem ele nunca dispara)');
  const ruim = await p.agir('u1', { acao: 'robos_salvar', tipo: 'preco_abaixo', ticker: 'PETR4', valor: -1 });
  assert.equal(ruim[0], 400);
  assert.equal(typeof ruim[1].error, 'string');
  const tipo = await p.agir('u1', { acao: 'robos_salvar', tipo: 'loteria' });
  assert.equal(tipo[0], 400);
});

test('robos_listar devolve os robôs; robos_apagar tira', async () => {
  preparar();
  const a = await p.agir('u1', { acao: 'robos_salvar', tipo: 'queda_dia', ticker: 'PETR4', pct: 3 });
  await p.agir('u1', { acao: 'robos_salvar', tipo: 'concentracao', pct: 40 });
  let l = await p.agir('u1', { acao: 'robos_listar' });
  assert.equal(l[0], 200);
  assert.equal(l[1].robos.length, 2);
  assert.deepEqual(l[1].disparos, []);
  assert.equal((await p.agir('u1', { acao: 'robos_apagar', id: a[1].id }))[0], 200);
  l = await p.agir('u1', { acao: 'robos_listar' });
  assert.equal(l[1].robos.length, 1);
});

test('robos_checar confere com a cotação ao vivo, marca o dia e guarda o disparo; no mesmo dia não repete', async () => {
  const { banco, chamadas } = preparar();
  await p.agir('u1', { acao: 'carteira_salvar', nome: 'Petrobras', tipo: 'acoes', ticker: 'PETR4', valor: 300 });
  const r1 = await p.agir('u1', { acao: 'robos_salvar', tipo: 'preco_abaixo', ticker: 'PETR4', valor: 35 });
  await p.agir('u1', { acao: 'robos_salvar', tipo: 'preco_acima', ticker: 'PETR4', valor: 50 });
  const c = await p.agir('u1', { acao: 'robos_checar' });
  assert.equal(c[0], 200);
  assert.equal(chamadas.length, 1, 'chamou carteiraAoVivo uma vez');
  assert.equal(chamadas[0].itens.length, 1, 'passou a carteira da pessoa');
  assert.ok(chamadas[0].op && chamadas[0].op.agora instanceof Date, 'passou { agora: Date }');
  // 1ª entrega (#3888) passava fetch: c.deps && c.deps.fetch, que no servidor é undefined (lá deps não tem fetch):
  // nada era cotado. Use c.deps.fetch || ((...a) => fetch(...a)), como em agirCotacoes.
  assert.equal(p.deps.fetch, undefined, 'como no servidor: deps sem fetch');
  assert.equal(typeof chamadas[0].op.fetch, 'function', 'sem deps.fetch, passe o fetch global ((...a) => fetch(...a))');
  console.log(JSON.stringify(c[1]));
  assert.equal(c[1].disparos.length, 1, 'só o preco_abaixo dispara (30 < 35); preco_acima 50 não');
  assert.equal(c[1].disparos[0].regra_id, r1[1].id);
  assert.ok(Array.isArray(c[1].lacunas));
  assert.equal(doc(banco, `robos/${r1[1].id}`).ultimo_disparo, '2026-11-17', 'marca o dia (Brasília) no robô');
  const l = await p.agir('u1', { acao: 'robos_listar' });
  assert.equal(l[1].disparos.length, 1);
  assert.equal(l[1].disparos[0].regra_id, r1[1].id);
  assert.equal(l[1].disparos[0].em, '2026-11-17T17:00:00.000Z');
  const de2 = await p.agir('u1', { acao: 'robos_checar' });
  assert.equal(de2[1].disparos.length, 0, 'no mesmo dia não dispara de novo');
});

test('robos_checar: 23h30 em Brasília ainda é o mesmo dia (UTC já virou)', async () => {
  const { banco } = preparar('2026-11-18T02:30:00.000Z');
  await p.agir('u1', { acao: 'carteira_salvar', nome: 'Petrobras', tipo: 'acoes', ticker: 'PETR4', valor: 300 });
  const r = await p.agir('u1', { acao: 'robos_salvar', tipo: 'preco_abaixo', ticker: 'PETR4', valor: 35 });
  await p.agir('u1', { acao: 'robos_checar' });
  assert.equal(doc(banco, `robos/${r[1].id}`).ultimo_disparo, '2026-11-17');
});

test('robos_checar usa a meta de alocação salva (rebalancear)', async () => {
  const { banco } = preparar();
  await banco.collection('prumo_users').doc('u1').collection('config').doc('alocacao').set({ alvo: { acoes: 60, renda_fixa: 40 } });
  await p.agir('u1', { acao: 'robos_salvar', tipo: 'rebalancear', desvio_pct: 5 });
  const c = await p.agir('u1', { acao: 'robos_checar' });
  assert.ok(c[1].disparos.length >= 1, 'ações 30% x meta 60%: dispara rebalancear');
  assert.ok(c[1].disparos.every((d) => d.tipo === 'rebalancear'));
});

test('ação que não é de robô: agirRobos devolve null', async () => {
  const { agirRobos } = require('../../netlify/functions/prumo-lib/robos');
  assert.equal(typeof agirRobos, 'function');
  assert.equal(await agirRobos('carteira_listar', {}, {}), null);
});
