'use strict';
// Contrato (dono 19/11, testando o app real): "não tem onde inserir o print da fatura dos cartões", "não tem botão de
// apagar", "mandei o print do extrato e ele não fez nada". Pronto quando:
// 1) prumo/cartoes.js tem o card "Fatura do cartão" (#ca-fat) que lê print/foto/PDF com doc_ler (via MB.docLeitura de
//    prumo/documentos.js) e mostra as compras para confirmar e gravar; o seletor de foto é image/* (Android).
// 2) cada cartão tem 🗑️ (cartao_apagar) e cada item previsto (13º, contas futuras) tem 🗑️ (lanc_apagar/pagamento_apagar).
// 3) na aba Documentos, escolher o arquivo já lê (sem precisar de outro toque).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ler = (f) => fs.readFileSync(path.join(__dirname, '../../prumo', f), 'utf8');

test('Cartões: card da fatura lê pelo mesmo leitor dos Documentos', () => {
  const s = ler('cartoes.js');
  assert.match(s, /id="ca-fat"/);
  assert.match(s, /id="ca-fat-arq" accept="image\/\*"/);
  assert.match(s, /docLeitura/);
  assert.match(s, /docs\.ler\(/); assert.match(s, /docs\.mostrar\(/);
  const d = ler('documentos.js');
  assert.match(d, /MB\.docLeitura = \{ mostrar: mostrarLeituraEm, ler: lerArquivos \}/);
  assert.match(d, /MB\.api\('doc_ler', \{ imagens \}\)/);
});

test('apagar: cartão e item previsto', () => {
  assert.match(ler('cartoes.js'), /data-apagar-cartao=/);
  assert.match(ler('cartoes.js'), /MB\.api\('cartao_apagar'/);
  const p = ler('previsto.js');
  assert.match(p, /data-prv="apagar"/);
  assert.match(p, /lancamentos: 'lanc_apagar', pagamentos: 'pagamento_apagar'/);
});

test('Documentos: escolher o print já lê', async () => {
  const m = {};
  const s = (sel) => (m[sel] = m[sel] || { sel, innerHTML: '', files: [], disabled: false, textContent: '', onclick: null, onchange: null, dataset: {},
    click() { if (this.onclick) return this.onclick({ currentTarget: this }); }, querySelector: (x) => s(`${sel} ${x}`), querySelectorAll: () => [], insertAdjacentHTML(_, h) { this.innerHTML = h + this.innerHTML; } });
  const el = { innerHTML: '', querySelector: s, querySelectorAll: () => [] };
  const window = { MB: { telas: {} } }; const MB = window.MB; const chamadas = [];
  MB.ui = { brl: (v) => `R$ ${v}`, esc: (x) => String(x == null ? '' : x), reduzir: async () => 'img', ok() {}, aba() {} };
  MB.pdf = { paraImagens: async () => ({ imagens: ['img'], cortou: false }) };
  MB.abrirAba = () => {};
  MB.api = async (acao) => { chamadas.push(acao); if (acao === 'lanc_listar') return { receitas: 0, despesas: 0, lancamentos: [] };
    if (acao === 'doc_ler') return { documento: 'extrato', imagens_lidas: 1, imagens_total: 1, prontos: [{ data: '2026-11-05', descricao: 'PIX MERCADO', valor: 80, tipo: 'despesa' }], conferir: [], ja_lancados: 0, receitas: 0, despesas: 80 };
    return {}; };
  const ctx = { window, document: { createElement: () => ({}), body: { appendChild() {} } }, console, setTimeout, clearTimeout, Promise, confirm: () => true };
  vm.runInNewContext(ler('documentos.js'), ctx);
  await MB.telas.documentos(el);
  const arq = s('#kf-arq'); arq.files = [{ name: 'print.png', type: 'image/png' }];
  assert.equal(typeof arq.onchange, 'function', 'o seletor reage ao escolher');
  await arq.onchange();
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(chamadas.includes('doc_ler'), 'leu sem outro toque');
  assert.match(s('#kf-res').innerHTML, /PIX MERCADO/);
});
