'use strict';
// Previsto x realizado (pedido do dono 17/11): o 13º de 19/11, com hoje = 17/11, é PREVISTO e não entra na receita;
// em 19/11 entra. Servidor com banco falso + telas rodando num vm com as respostas REAIS do servidor.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const p = require('../../netlify/functions/prumo.js');
const prv = require('../../netlify/functions/prumo-lib/previsto.js');

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
function agoraEm(iso) { p.deps.agora = () => new Date(iso); }
function preparar(iso) { const banco = bancoFalso(); p.deps.db = () => banco; agoraEm(iso); }

const DECIMO = { tipo: 'decimo_terceiro_1', mes: '2026-11', data_pagamento: '2026-11-19', bruto: 5883.37, liquido: 5883.37, empresa: 'Empresa X' };
const L = (o) => ({ data: '2026-11-10', descricao: 'ITEM', estabelecimento: 'ITEM', valor: 100, tipo: 'despesa', categoria: 'outros', confianca: 1, ...o });

test('funções puras: status de nascimento e de leitura', () => {
  assert.equal(prv.hojeDe('2026-11-17T01:00:00Z'), '2026-11-16', 'Brasil é UTC-3');
  assert.equal(prv.statusInicial('2026-11-19', '2026-11-17'), 'previsto');
  assert.equal(prv.statusInicial('2026-11-17', '2026-11-17'), 'realizado', 'data de hoje já é realizado');
  assert.equal(prv.statusDe({ data: '2026-11-19', status: 'previsto' }, 'data', '2026-11-17'), 'previsto');
  assert.equal(prv.statusDe({ data: '2026-11-19', status: 'previsto' }, 'data', '2026-11-19'), 'realizado', 'vira sozinho no dia');
  assert.equal(prv.statusDe({ data: '2026-11-19' }, 'data', '2026-11-17'), 'previsto', 'item antigo sem status, com data futura');
  assert.equal(prv.statusDe({ data: '2026-11-19', status: 'realizado' }, 'data', '2026-11-17'), 'realizado', 'botão Caiu');
  assert.equal(prv.realizados([{ data: '2026-11-18' }, { data: '2026-11-16' }], 'data', '2026-11-17').length, 1);
});

test('13º de 19/11 com hoje 17/11: previsto, fora do recebido; em 19/11 entra', async () => {
  preparar('2026-11-17T12:00:00Z');
  await p.agir('u1', { acao: 'pagamento_salvar', ...DECIMO });
  let r = (await p.agir('u1', { acao: 'salario_previsao', mes: '2026-11' }))[1];
  assert.equal(r.total_recebido, 0);
  assert.equal(r.recebidos.length, 0);
  assert.equal(r.a_receber.length, 1);
  assert.equal(r.total_a_receber, 5883.37);
  assert.equal((await p.agir('u1', { acao: 'pagamento_listar', mes: '2026-11' }))[1].pagamentos[0].status, 'previsto');
  agoraEm('2026-11-19T12:00:00Z'); // mesmo dado, sem cron: só o relógio andou
  r = (await p.agir('u1', { acao: 'salario_previsao', mes: '2026-11' }))[1];
  assert.equal(r.total_recebido, 5883.37);
  assert.equal(r.recebidos.length, 1);
  assert.equal(r.a_receber.length, 0);
});

test('✅ Caiu confirma antes da data; "Ainda não caiu" adia (só para depois de hoje)', async () => {
  preparar('2026-11-17T12:00:00Z');
  const { 1: { id } } = await p.agir('u1', { acao: 'pagamento_salvar', ...DECIMO });
  let r = await p.agir('u1', { acao: 'previsto_adiar', colecao: 'pagamentos', id, data: '2026-11-17' });
  assert.equal(r[0], 400);
  r = await p.agir('u1', { acao: 'previsto_adiar', colecao: 'pagamentos', id, data: '2026-11-25' });
  assert.equal(r[0], 200);
  let s = (await p.agir('u1', { acao: 'pagamento_listar' }))[1].pagamentos[0];
  assert.equal(s.data_pagamento, '2026-11-25'); assert.equal(s.status, 'previsto');
  assert.equal((await p.agir('u1', { acao: 'previsto_confirmar', colecao: 'pagamentos', id }))[0], 200);
  s = (await p.agir('u1', { acao: 'pagamento_listar' }))[1].pagamentos[0];
  assert.equal(s.status, 'realizado');
  assert.equal((await p.agir('u1', { acao: 'salario_previsao', mes: '2026-11' }))[1].total_recebido, 5883.37);
  assert.equal((await p.agir('u1', { acao: 'previsto_confirmar', colecao: 'config', id }))[0], 400, 'só lancamentos e pagamentos');
  assert.equal((await p.agir('u1', { acao: 'previsto_confirmar', colecao: 'pagamentos', id: 'nao-existe' }))[0], 400);
});

async function montarMes() {
  preparar('2026-11-17T12:00:00Z');
  await p.agir('u1', { acao: 'doc_confirmar', lancamentos: [
    L({ descricao: 'MERCADO', valor: 100 }),
    L({ descricao: 'SALARIO', tipo: 'receita', valor: 1000, data: '2026-11-05' }),
    L({ descricao: 'CONTA DE LUZ', valor: 250, data: '2026-11-25' }), // a pagar
    L({ descricao: 'REEMBOLSO', tipo: 'receita', valor: 300, data: '2026-11-30' }), // a receber
  ] });
  await p.agir('u1', { acao: 'pagamento_salvar', ...DECIMO });
  await p.agir('u1', { acao: 'divida_salvar', credor: 'Banco Y', tipo: 'emprestimo', saldo: 5000, juros_mes: 2, parcela: 400, dia_vencimento: 28 });
}

test('lançamentos futuros nascem previstos e ficam fora dos totais; a receber / a pagar à parte', async () => {
  await montarMes();
  const l = (await p.agir('u1', { acao: 'lanc_listar', mes: '2026-11' }))[1];
  assert.equal(l.receitas, 1000); assert.equal(l.despesas, 100);
  assert.equal(l.a_receber, 300); assert.equal(l.a_pagar, 250);
  assert.deepEqual(l.lancamentos.filter((x) => x.status === 'previsto').map((x) => x.descricao).sort(), ['CONTA DE LUZ', 'REEMBOLSO']);
  const r = (await p.agir('u1', { acao: 'inicio_resumo', mes: '2026-11' }))[1];
  assert.equal(r.receitas, 1000, 'receita só do que já caiu'); assert.equal(r.despesas, 100); assert.equal(r.economia, 900);
  assert.equal(r.a_receber, 300 + 5883.37, 'reembolso + 13º');
  assert.equal(r.a_pagar, 250 + 400, 'conta de luz + parcela da dívida que vence dia 28');
  assert.ok(r.previstos.some((x) => x.origem === 'divida' && x.colecao === null));
});

test('✅ Paguei na conta de luz: passa a contar como gasto', async () => {
  await montarMes();
  const luz = (await p.agir('u1', { acao: 'lanc_listar', mes: '2026-11' }))[1].lancamentos.find((x) => x.descricao === 'CONTA DE LUZ');
  await p.agir('u1', { acao: 'previsto_confirmar', colecao: 'lancamentos', id: luz.id });
  const r = (await p.agir('u1', { acao: 'inicio_resumo', mes: '2026-11' }))[1];
  assert.equal(r.despesas, 350); assert.equal(r.a_pagar, 400);
});

// ---------- telas, rodando o código com as respostas reais do servidor ----------
const lerFront = (f) => fs.readFileSync(path.join(__dirname, '../../prumo', f), 'utf8');
function botoesDe(html) {
  return [...html.matchAll(/<button[^>]*data-prv="(\w+)"[^>]*data-colecao="([^"]+)"[^>]*data-id="([^"]+)"/g)].map((m) => ({ dataset: { prv: m[1], colecao: m[2], id: m[3] }, onclick: null }));
}
function montarFront(respostas) {
  const chamadas = []; const forms = []; const avisos = [];
  const stubs = {};
  const stub = (sel) => (stubs[sel] = stubs[sel] || { onclick: null, dataset: {} });
  const el = { innerHTML: '', querySelector: stub, querySelectorAll: () => [] };
  const MB = { telas: {} };
  MB.api = async (acao, dados) => { chamadas.push({ acao, dados }); return respostas[acao] !== undefined ? respostas[acao] : { ok: true }; };
  MB.ui = { aba() {}, brl: (v) => `R$ ${Number(v).toFixed(2)}`, esc: (s) => String(s == null ? '' : s), barra: () => '', formulario: (t, c, aoSalvar) => forms.push({ t, c, aoSalvar }), recarregar() {}, ok: (m) => avisos.push(m) };
  const document = { createElement: () => ({}), body: { appendChild: (s) => { if (s.onload) setTimeout(s.onload, 0); } } };
  const ctx = { window: { MB }, document, console, setTimeout, clearTimeout, Promise };
  vm.runInNewContext(lerFront('previsto.js'), ctx);
  vm.runInNewContext(lerFront('salario.js'), ctx);
  vm.runInNewContext(lerFront('inicio.js'), ctx);
  const ligarBotoes = () => { const bs = botoesDe(el.innerHTML); el.querySelectorAll = (s) => (s === '[data-prv]' ? bs : []); return bs; };
  return { MB, el, chamadas, forms, avisos, ligarBotoes };
}

test('tela Salário: 13º previsto fica em "A receber", fora do total recebido', async () => {
  await montarMes();
  const sal = (await p.agir('u1', { acao: 'salario_previsao', mes: '2026-11' }))[1];
  const t = montarFront({});
  const h = t.MB.salario.cartao(sal);
  assert.match(h, /Nenhum recebimento lançado neste mês\./);
  assert.match(h, /A receber \(ainda não caiu\)[\s\S]*13º \(1ª parcela\)[\s\S]*19\/11[\s\S]*5\.883,37/);
  assert.match(h, /✅ Caiu/);
  assert.doesNotMatch(h, /Total recebido/);
});
