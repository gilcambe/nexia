'use strict';
// Contrato: Kernex Finance — a tela Mercado abre VAZIA (1ª entrega, #3900). Visto na prévia: só a caixa de busca, sem
// estilo, e nenhum ativo: desenhar() nunca é chamado ao abrir, os cartões .mk-* não têm CSS e a tela não carrega ui.js.
// Pedido, em prumo/mercado.js:
//  1) carregue /prumo/ui.js como as outras telas (const { esc, aba } = await carregarUi(); aba('mercado')) — isso dá o
//     estilo da caixa de busca e dos cartões base;
//  2) função PURA exportada  MB.mercado = { cartoes(lista, porTicker) }  que devolve o HTML (texto) dos cartões:
//       lista = ['PETR4', ...]; porTicker = { PETR4: { preco, variacao_dia_pct, fonte, data_hora } } (pode faltar ativo)
//     - um <div class="mk-card" data-ticker="PETR4"> por ativo, na ordem da lista;
//     - preço em R$ no padrão brasileiro ("R$ 41,50"; sem cotação: "R$ --");
//     - variação com sinal e vírgula ("+2,31%" / "-1,90%") num <span> com style="color:var(--ganho)" se >= 0 ou
//       style="color:var(--perda)" se < 0; sem variação: "--";
//     - botão <button type="button" data-remover="PETR4" aria-label="Tirar PETR4 da lista">;
//     - textos passam por esc();
//  3) ao abrir: escreva a estrutura em el.innerHTML com <input id="mk-busca" type="search">, <div id="mk-resultado"> e
//     <div id="mk-lista">; JÁ desenhe os cartões (com "R$ --") em #mk-lista ANTES de esperar a cotação; depois de
//     'mercado_cotar', redesenhe com os preços (#mk-lista.innerHTML = MB.mercado.cartoes(lista, porTicker));
//  4) tirar da lista por delegação: #mk-lista.onclick lê e.target.closest('[data-remover]');
//  5) CSS dos cartões injetado pela própria tela (um <style id="mk-estilo"> uma vez só), com .mk-card em grade de 2
//     colunas no celular (#mk-lista { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px }),
//     cartão com fundo var(--cartao), borda var(--borda), cantos arredondados, preço grande (.mk-preco).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const codigo = fs.readFileSync(path.join(__dirname, '../../prumo/mercado.js'), 'utf8');

function montar(api) {
  const nos = {};
  const no = (sel) => (nos[sel] = nos[sel] || { sel, innerHTML: '', value: '', textContent: '', onclick: null, oninput: null, addEventListener() {}, querySelectorAll: () => [], querySelector: () => null, appendChild() {} });
  const el = { innerHTML: '', querySelector: (s) => no(s), querySelectorAll: () => [] };
  const head = { appendChild: (x) => { nos.__estilos = (nos.__estilos || 0) + 1; nos.__css = (nos.__css || '') + (x.textContent || ''); } };
  const document = { createElement: () => ({ textContent: '', id: '' }), head, body: head, getElementById: (id) => (id === 'mk-estilo' && nos.__estilos ? {} : null) };
  const timers = [];
  const window = { MB: { telas: {}, api, abrirAba: () => {}, ui: { esc: (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])), aba: () => {}, brl: (n) => 'R$ ' + n } } };
  const ctx = { window, MB: window.MB, document, console, Promise, localStorage: { getItem: () => null, setItem: () => {} },
    setTimeout: (f, ms) => { timers.push(ms); return 1; }, clearTimeout: () => {}, setInterval: (f, ms) => { timers.push(ms); return 2; }, clearInterval: () => {} };
  vm.runInNewContext(codigo, ctx);
  return { window, el, nos, timers };
}
const COT = { cotacoes: [{ ticker: 'PETR4', preco: 41.5, variacao_dia_pct: 2.31, fonte: 'yahoo' }, { ticker: 'VALE3', preco: 60.12, variacao_dia_pct: -1.9, fonte: 'yahoo' }], invalidos: [], em_pregao: true };

test('cartoes(): um cartão por ativo, preço em R$, variação colorida, botão de tirar, texto escapado', () => {
  const { window } = montar(async () => COT);
  assert.ok(window.MB.mercado && typeof window.MB.mercado.cartoes === 'function', 'MB.mercado.cartoes');
  const h = window.MB.mercado.cartoes(['PETR4', 'VALE3', 'ITUB4'], { PETR4: { preco: 41.5, variacao_dia_pct: 2.31 }, VALE3: { preco: 60.12, variacao_dia_pct: -1.9 } });
  assert.equal((h.match(/class="mk-card"/g) || []).length, 3);
  assert.ok(h.indexOf('data-ticker="PETR4"') < h.indexOf('data-ticker="VALE3"') && h.indexOf('data-ticker="VALE3"') < h.indexOf('data-ticker="ITUB4"'), 'na ordem da lista');
  assert.match(h, /R\$ 41,50/); assert.match(h, /R\$ 60,12/); assert.match(h, /R\$ --/);
  assert.match(h, /color:var\(--ganho\)[^>]*>\+2,31%/);
  assert.match(h, /color:var\(--perda\)[^>]*>-1,90%/);
  assert.match(h, /data-remover="ITUB4"/);
  const x = window.MB.mercado.cartoes(['<i>x'], {});
  assert.doesNotMatch(x, /<i>x/, 'escapado'); assert.match(x, /&lt;i&gt;x/);
});

test('ao abrir: busca, lista padrão já desenhada antes da cotação, depois os preços; atualiza a cada 30 s', async () => {
  let soltar; const espera = new Promise((r) => { soltar = r; });
  const chamadas = [];
  const { window, el, nos, timers } = montar(async (a, d) => { chamadas.push([a, d]); await espera; return COT; });
  const fim = window.MB.telas.mercado(el);
  await new Promise((r) => setImmediate(r));
  assert.match(el.innerHTML, /id="mk-busca"[^>]*type="search"|type="search"[^>]*id="mk-busca"/);
  assert.match(el.innerHTML, /id="mk-lista"/);
  const lista = nos['#mk-lista'];
  assert.ok(lista, 'usa #mk-lista');
  for (const t of ['PETR4', 'VALE3', 'ITUB4', 'BBAS3', 'MXRF11', 'HGLG11', 'BOVA11', 'IVVB11']) assert.match(lista.innerHTML, new RegExp(`data-ticker="${t}"`), `${t} aparece ANTES da cotação chegar`);
  soltar(); await fim; await new Promise((r) => setImmediate(r));
  assert.ok(chamadas.some(([a]) => a === 'mercado_cotar'), 'chama mercado_cotar');
  assert.match(lista.innerHTML, /R\$ 41,50/, 'depois da cotação, os preços aparecem');
  assert.ok(timers.includes(30000), 'atualiza a cada 30 s');
  assert.equal(typeof lista.onclick, 'function', 'tirar da lista por delegação (#mk-lista.onclick)');
  assert.ok(nos.__estilos === 1, 'injeta o <style id="mk-estilo"> uma vez');
  assert.match(nos.__css, /#mk-lista\s*\{[^}]*display\s*:\s*grid/);
  assert.match(nos.__css, /grid-template-columns\s*:\s*repeat\(\s*2\s*,\s*minmax\(\s*0\s*,\s*1fr\s*\)\s*\)/);
  assert.match(nos.__css, /\.mk-card\s*\{[^}]*background\s*:\s*var\(--cartao\)/);
  assert.match(nos.__css, /\.mk-preco\s*\{/);
});
