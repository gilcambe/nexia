'use strict';
// Contrato: Kernex Finance — os gráficos do Início saem VAZIOS (1ª entrega, #3891).
// Causa: a API devolve OBJETOS, não listas:
//   MB.api('historico_listar') -> { meses: [{ mes: '2026-10', total: 44900, variacao, variacao_pct }, ...] }
//   MB.api('cotacoes_vivas')   -> { itens: [{ ticker, nome, vivo: { valor, variacao_dia_pct, ... } }, ...], total, ... }
// e prumo/inicio.js faz Array.isArray(hist) / Array.isArray(cot), que dá false: nada é desenhado.
// Pedido: em prumo/inicio.js, use hist.meses e cot.itens (com "|| []" para quando vierem vazios).
// Este teste RODA a tela com dados falsos e confere o desenho.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ler = (f) => fs.readFileSync(path.join(__dirname, '../../prumo', f), 'utf8');
const RESUMO = { alertas_limite: [], saldo_disponivel: 3250.4, patrimonio: { liquido: 48230.1 }, investimentos: 41200, milhas_estimado: 0, receitas: 8500, despesas: 6120, economia: 2380, qtd_lancamentos: 3, variacao_despesas_pct: -8.5, por_categoria: {}, dividas: { registradas: false }, vencimentos: [], lacunas: [] };
const SAUDE = { nota: 72, indicadores: [], aviso: 'ok', nota_mes_anterior: null };

async function rodar(api) {
  const window = { MB: { telas: {}, abrirAba: () => {}, usuario: () => null } };
  const ctx = { window, document: { createElement: () => ({}), body: { appendChild: () => {} } }, console, setTimeout, clearTimeout, Promise };
  vm.runInNewContext(ler('graficos.js'), ctx);
  window.MB.ui = { brl: (n) => 'R$ ' + Number(n).toFixed(2), esc: (s) => String(s), barra: () => '', aba: () => {} };
  window.MB.api = api;
  vm.runInNewContext(ler('inicio.js'), ctx);
  const botao = () => ({ onclick: null });
  const el = { innerHTML: '', querySelector: () => botao() };
  await window.MB.telas.inicio(el);
  await new Promise((r) => setTimeout(r, 50));
  return el.innerHTML;
}
const corte = (html, id) => { const i = html.indexOf(`id="${id}"`); return i < 0 ? '' : html.slice(i, html.indexOf('</div></div>', i) + 12 || undefined); };

test('com histórico e cotações, os dois gráficos aparecem desenhados', async () => {
  const html = await rodar(async (a) => ({
    inicio_resumo: RESUMO, saude_financeira: SAUDE,
    historico_listar: { meses: [{ mes: '2026-09', total: 42100 }, { mes: '2026-10', total: 44900 }, { mes: '2026-11', total: 48230 }] },
    cotacoes_vivas: { itens: [{ ticker: 'PETR4', vivo: { valor: 4150, variacao_dia_pct: 2.3 } }, { ticker: 'VALE3', vivo: { valor: 6000, variacao_dia_pct: -1.9 } }, { ticker: 'CDB', vivo: null }], total: 10150 },
  })[a]);
  const pat = corte(html, 'kf-graf-patrimonio');
  assert.ok(pat, 'card #kf-graf-patrimonio');
  assert.match(pat, /<polyline/, 'linha do patrimônio desenhada (use hist.meses)');
  const hoje = corte(html, 'kf-graf-hoje');
  assert.ok(hoje, 'card #kf-graf-hoje');
  assert.equal((hoje.match(/data-sinal="/g) || []).length, 2, 'uma barra por ativo com cotação (use cot.itens)');
  assert.match(hoje, /data-sinal="ganho"/);
  assert.match(hoje, /data-sinal="perda"/);
});

test('sem dados (listas vazias) ou API falhando: a tela abre e não quebra', async () => {
  const vazio = await rodar(async (a) => ({ inicio_resumo: RESUMO, saude_financeira: SAUDE, historico_listar: { meses: [] }, cotacoes_vivas: { itens: [] } })[a]);
  assert.match(vazio, /Saldo disponível/);
  const falha = await rodar(async (a) => { if (a === 'historico_listar' || a === 'cotacoes_vivas') throw new Error('fora do ar'); return { inicio_resumo: RESUMO, saude_financeira: SAUDE }[a]; });
  assert.match(falha, /Saldo disponível/);
});
