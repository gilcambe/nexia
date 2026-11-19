'use strict';
// Contrato (épico #4013, fase 2; manual "CFO Pessoal Inteligente", seções 2 e 7): o Início responde em segundos
// "quanto tenho, quanto está comprometido e quanto posso gastar".
// 1) netlify/functions/prumo-lib/financas.js exporta tresNumeros({ saldo, a_pagar, reserva, hoje }):
//    tenho = saldo (null quando não há contas); comprometido = a_pagar (contas/parcelas previstas do mês, ainda não pagas);
//    reserva = reserva mínima (padrão 0); posso_gastar = max(0, tenho − comprometido − reserva), em centavos certos;
//    ate = último dia do mês de "hoje" (AAAA-MM-DD). Sem saldo: tenho, posso_gastar = null.
// 2) a ação inicio_resumo (prumo-lib/documentos.js) devolve tres_numeros = tresNumeros(...), com a reserva lida de
//    config/caixa (campo reserva_minima); nada que já existe na resposta some.
// 3) prumo/inicio.js mostra, NO TOPO, o card id="kf-tres-numeros" com "Quanto tenho", "Comprometido" e
//    "Posso gastar" (com "até DD/MM"). Sem saldo: mostra "—" e o convite para cadastrar contas. Nada do Início sai.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const raiz = path.join(__dirname, '../..');
const fin = require(path.join(raiz, 'netlify/functions/prumo-lib/financas.js'));

test('tresNumeros: tenho, comprometido, reserva e posso gastar', () => {
  assert.equal(typeof fin.tresNumeros, 'function', 'financas.js exporta tresNumeros');
  const r = fin.tresNumeros({ saldo: 5000.1, a_pagar: 1800.05, reserva: 500, hoje: '2026-11-19' });
  assert.equal(r.tenho, 5000.1);
  assert.equal(r.comprometido, 1800.05);
  assert.equal(r.reserva, 500);
  assert.equal(r.posso_gastar, 2700.05);
  assert.equal(r.ate, '2026-11-30');
});

test('tresNumeros: nunca negativo, reserva padrão 0, fevereiro e sem saldo', () => {
  assert.equal(fin.tresNumeros({ saldo: 1000, a_pagar: 1500, hoje: '2026-11-01' }).posso_gastar, 0);
  const s = fin.tresNumeros({ saldo: 1000, a_pagar: 0, hoje: '2028-02-10' });
  assert.equal(s.reserva, 0);
  assert.equal(s.posso_gastar, 1000);
  assert.equal(s.ate, '2028-02-29');
  const n = fin.tresNumeros({ saldo: null, a_pagar: 300, hoje: '2026-11-19' });
  assert.equal(n.tenho, null);
  assert.equal(n.posso_gastar, null);
  assert.equal(n.comprometido, 300);
});

test('inicio_resumo devolve tres_numeros com a reserva de config/caixa', () => {
  const src = fs.readFileSync(path.join(raiz, 'netlify/functions/prumo-lib/documentos.js'), 'utf8');
  const bloco = src.slice(src.indexOf("case 'inicio_resumo'"), src.indexOf('default:', src.indexOf("case 'inicio_resumo'")));
  assert.match(bloco, /tresNumeros\(/, 'usa fin.tresNumeros');
  assert.match(bloco, /tres_numeros/, 'devolve tres_numeros');
  assert.match(bloco, /'caixa'/, 'lê config/caixa');
  assert.match(bloco, /reserva_minima/, 'campo reserva_minima');
  for (const k of ['saldo_disponivel', 'a_pagar', 'a_receber', 'fluxo_inicio', 'patrimonio', 'lacunas']) assert.match(bloco, new RegExp(k), `${k} continua na resposta`);
});

const BASE = { alertas_limite: [], saldo_disponivel: 5000.1, patrimonio: { liquido: 48230.1 }, investimentos: 0, milhas_estimado: 0, receitas: 8500, despesas: 6120, economia: 2380, qtd_lancamentos: 3, variacao_despesas_pct: null, por_categoria: {}, dividas: { registradas: false }, vencimentos: [], lacunas: [], a_receber: 0, a_pagar: 1800.05 };

async function rodar(resumo) {
  const window = { MB: { telas: {}, abrirAba: () => {}, usuario: () => null } };
  const ctx = { window, document: { createElement: () => ({}), body: { appendChild: () => {} } }, console, setTimeout, clearTimeout, Promise };
  const g = path.join(raiz, 'prumo/graficos.js');
  if (fs.existsSync(g)) vm.runInNewContext(fs.readFileSync(g, 'utf8'), ctx);
  window.MB.ui = { brl: (n) => 'R$ ' + Number(n).toFixed(2).replace('.', ','), esc: (s) => String(s), barra: () => '', aba: () => {} };
  window.MB.api = async (a) => ({ inicio_resumo: resumo, saude_financeira: { nota: 70, indicadores: [], aviso: 'ok', nota_mes_anterior: null } })[a] || null;
  vm.runInNewContext(fs.readFileSync(path.join(raiz, 'prumo/inicio.js'), 'utf8'), ctx);
  const el = { innerHTML: '', querySelector: () => ({ onclick: null, addEventListener: () => {} }), querySelectorAll: () => [] };
  await window.MB.telas.inicio(el);
  await new Promise((r) => setTimeout(r, 50));
  return el.innerHTML;
}

test('Início: card dos três números no topo', async () => {
  const html = await rodar({ ...BASE, tres_numeros: { tenho: 5000.1, comprometido: 1800.05, reserva: 500, posso_gastar: 2700.05, ate: '2026-11-30' } });
  const i = html.indexOf('id="kf-tres-numeros"');
  assert.ok(i >= 0, 'card #kf-tres-numeros');
  const hero = html.indexOf('kf-hero');
  assert.ok(hero < 0 || i < hero, 'fica antes do card de saldo (topo)');
  const card = html.slice(i, i + 3000);
  for (const t of ['Quanto tenho', 'Comprometido', 'Posso gastar']) assert.match(card, new RegExp(t), `mostra "${t}"`);
  assert.match(card, /2700,05/, 'valor de posso gastar');
  assert.match(card, /até 30\/11/, 'período "até DD/MM"');
});

test('Início sem contas: três números com "—" e convite, sem quebrar', async () => {
  const html = await rodar({ ...BASE, saldo_disponivel: null, lacunas: ['contas'], tres_numeros: { tenho: null, comprometido: 300, reserva: 0, posso_gastar: null, ate: '2026-11-30' } });
  const i = html.indexOf('id="kf-tres-numeros"');
  assert.ok(i >= 0, 'card aparece mesmo sem contas');
  const card = html.slice(i, i + 3000);
  assert.match(card, /—/);
  assert.match(card, /Contas/, 'convida a cadastrar contas');
});

test('Início com resposta antiga (sem tres_numeros) não quebra', async () => {
  const html = await rodar(BASE);
  assert.ok(html.length > 0);
});
