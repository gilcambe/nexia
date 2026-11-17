'use strict';
// 17/11, medido no celular do dono: o Início levava ~1 min (esperava score, gráfico e cotação em fila) e a cotação ao
// vivo dava 500. Regras: o principal aparece sem esperar os opcionais; cotacoes_vivas nunca dá 500; opcional é silencioso.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ler = (f) => fs.readFileSync(path.join(__dirname, '../../prumo', f), 'utf8');

function montar(lentoMs) {
  const chamadas = [];
  const el = { innerHTML: '', querySelector: (sel) => (el.innerHTML.includes(`id="${sel.slice(1)}"`) ? (el[sel] = el[sel] || { innerHTML: '', onclick: null }) : null), querySelectorAll: () => [] };
  const window = { MB: { telas: {} } }; const MB = window.MB;
  MB.ui = { brl: (v) => `R$ ${v}`, esc: (s) => String(s == null ? '' : s), barra: () => '', aba() {}, reduzir() {}, formulario() {}, ok() {} };
  MB.graficos = { linha: () => '<svg id="linha"></svg>', barras: () => '<svg id="barras"></svg>', ganhoDoDia: () => 1 };
  MB.score = { cartao: () => '<div id="cartao-score">score</div>', ligar() {} };
  MB.previsto = null; MB.abrirAba = () => {}; MB.usuario = () => null;
  const devagar = (v) => new Promise((ok) => setTimeout(() => ok(v), lentoMs));
  MB.api = async (acao, dados, opts) => {
    chamadas.push({ acao, opts });
    if (acao === 'inicio_resumo') return { qtd_lancamentos: 0, alertas_limite: [], saldo_disponivel: null, patrimonio: { liquido: 0 }, investimentos: 0, receitas: 0, despesas: 0, economia: 0, dividas: { registradas: 0, sem: false }, vencimentos: [], lacunas: [], por_categoria: {}, a_receber: 0, a_pagar: 0, previstos: [] };
    if (acao === 'saude_financeira') return { indicadores: [], completa: false, nota: null };
    if (acao === 'score_listar') return devagar({});
    if (acao === 'historico_listar') return devagar({ meses: [{ mes: '2026-10', total: 1 }] });
    if (acao === 'cotacoes_vivas') return devagar({ itens: [{ ticker: 'X' }] });
    return {};
  };
  const ctx = { window, document: { createElement: () => ({}), body: { appendChild() {} } }, console, setTimeout, clearTimeout, Promise };
  vm.runInNewContext(ler('inicio.js'), ctx);
  return { MB, el, chamadas };
}

test('Início aparece sem esperar score, gráfico e cotação lentos; eles entram depois', async () => {
  const t = montar(4000);
  const t0 = Date.now();
  await t.MB.telas.inicio(t.el);
  assert.ok(Date.now() - t0 < 2500, `abriu em ${Date.now() - t0} ms (tem que ser < 2,5 s)`);
  assert.match(t.el.innerHTML, /id="kf-saude"/, 'o principal já está na tela');
  assert.match(t.el.innerHTML, /id="kf-score"/);
  await new Promise((r) => setTimeout(r, 4300));
  assert.match(t.el['#kf-score'].innerHTML, /cartao-score/, 'score entra quando chega');
  assert.match(t.el['#kf-patrim-corpo'].innerHTML, /linha/, 'gráfico entra quando chega');
  for (const a of ['score_listar', 'historico_listar', 'cotacoes_vivas']) {
    const c = t.chamadas.find((x) => x.acao === a);
    assert.ok(c && c.opts && c.opts.silencioso, `${a} é silenciosa (sem faixa vermelha)`);
  }
});

test('opcional rápido entra junto, sem "Carregando…"', async () => {
  const t = montar(10);
  await t.MB.telas.inicio(t.el);
  assert.match(t.el.innerHTML, /cartao-score/);
  assert.match(t.el.innerHTML, /id="linha"/);
});

test('app e cache repassam o silencioso; cotacoes_vivas nunca dá 500', async () => {
  assert.match(ler('app.js'), /async function api\(acao, dados, opts\)/);
  assert.match(ler('app.js'), /opts && opts\.silencioso/);
  assert.match(ler('cache-api.js'), /apiReal\(acao, dados, opts\)/);
  const p = require('../../netlify/functions/prumo.js');
  const dados = new Map();
  const col = (c) => ({ doc: (id) => ({ set: async (v) => { dados.set(`${c}/${id}`, v); }, get: async () => ({ exists: false, data: () => null }), collection: (n) => col(`${c}/${id}/${n}`) }),
    get: async () => ({ docs: [...dados.entries()].filter(([k]) => k.startsWith(c + '/') && !k.slice(c.length + 1).includes('/')).map(([k, v]) => ({ id: k.split('/').pop(), data: () => v })) }), where: () => col(c), orderBy: () => col(c), limit: () => col(c) });
  p.deps.db = () => ({ collection: col });
  p.deps.agora = () => new Date('2026-11-17T17:00:00Z');
  p.deps.fetch = async () => { throw new Error('fonte fora do ar'); };
  await p.agir('u1', { acao: 'carteira_salvar', itens: [{ ticker: 'PETR4', nome: 'Petrobras', tipo: 'acao', quantidade: 10, preco_medio: 30 }] }).catch(() => null);
  const r = await p.agir('u1', { acao: 'cotacoes_vivas' });
  delete p.deps.fetch;
  assert.equal(r[0], 200, 'fonte fora do ar não vira 500');
});
