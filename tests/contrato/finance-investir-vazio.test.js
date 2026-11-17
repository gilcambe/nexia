'use strict';
// #3954 (achado do PC 2, 17/11): a aba Investir quebrava sem nenhum investimento (conta nova ou logo depois de
// "Limpar e refazer"): o botão #limpar-carteira só existe com ativos e o clique era ligado sem checar.
// Este teste RODA a tela com a resposta REAL do servidor (invest_visao de uma conta vazia), num elemento falso.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const p = require('../../netlify/functions/prumo.js');

function bancoFalso() {
  const dados = new Map();
  const col = (c) => ({
    doc: (id) => ({ collection: (n) => col(`${c}/${id}/${n}`), set: async (v) => { dados.set(`${c}/${id}`, v); }, delete: async () => { dados.delete(`${c}/${id}`); }, get: async () => { const v = dados.get(`${c}/${id}`); return { exists: !!v, data: () => v }; } }),
    get: async () => ({ docs: [...dados.entries()].filter(([k]) => k.startsWith(c + '/') && !k.slice(c.length + 1).includes('/')).map(([k, v]) => ({ id: k.split('/').pop(), data: () => v })) }),
    where: () => col(c), orderBy: () => col(c), limit: () => col(c),
  });
  return { collection: col };
}

async function rodarTela(respostaPrompt) {
  p.deps.db = () => bancoFalso();
  p.deps.agora = () => new Date('2026-11-17T20:00:00Z'); // fora do pregão: sem timer
  const visao = (await p.agir('u1', { acao: 'invest_visao' }))[1];
  assert.ok(Array.isArray(visao.itens) && visao.itens.length === 0, 'conta vazia');
  const stubs = {};
  const el = {
    innerHTML: '',
    // Como no navegador: só existe o que foi desenhado. #limpar-carteira só aparece com ativos.
    querySelector: (sel) => (el.innerHTML.includes(sel.replace('#', 'id="')) ? (stubs[sel] = stubs[sel] || { onclick: null, value: '', innerHTML: '', textContent: '' }) : null),
    querySelectorAll: () => [],
  };
  const window = { MB: { telas: {} } };
  window.MB.ui = { brl: (v) => `R$ ${v}`, esc: (s) => String(s == null ? '' : s), TIPOS: {}, formulario() {}, aba() {}, ok() {} };
  window.MB.api = async (acao) => (acao === 'invest_visao' ? visao : {});
  const erros = [];
  const ctx = { window, document: { createElement: () => ({}), body: { appendChild() {} } }, console, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {}, Promise, prompt: () => respostaPrompt };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../prumo/investimentos.js'), 'utf8'), ctx);
  try { await window.MB.telas.investimentos(el); await new Promise((r) => setTimeout(r, 10)); } catch (e) { erros.push(e); }
  return { el, erros };
}

test('aba Investir abre com a carteira vazia (sem o botão Limpar)', async () => {
  const { el, erros } = await rodarTela(null);
  assert.deepEqual(erros.map((e) => e.message), [], 'não pode lançar erro');
  assert.ok(el.innerHTML.length > 0, 'desenhou a tela');
  assert.doesNotMatch(el.innerHTML, /id="limpar-carteira"/, 'sem ativos não mostra Limpar');
});

test('Cancelar no prompt de Limpar não quebra', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../prumo/investimentos.js'), 'utf8');
  assert.match(src, /\(prompt\([^)]*\)\s*\|\|\s*''\)\.toUpperCase\(\)/, 'prompt cancelado (null) vira texto vazio');
});
