'use strict';
// Contrato (redesign do Finance, fase 1): funções PURAS em netlify/functions/prumo-lib/saude5.js.
//  - scoreSaude(p): score 0-100 em 5 pilares (fluxo 25, reserva 25, dívidas 20, futuro 20, organização 10).
//    Pilar sem dado = estado 'sem_dados' e pontos null (NUNCA zero). O total é proporcional só aos pilares com dado
//    (round(soma pontos / soma pesos com dado * 100)) e vem com estimado = true se faltar algum pilar.
//    Nenhum pilar com dado -> total null e faixa 'sem_dados'. Faixas: 0-39 critico, 40-59 atencao, 60-79 tranquilo, 80-100 excelente.
//    Notas: fluxo = min(1, max(0, sobra/renda) / 0.20) * 25 (precisa renda > 0 e sobra != null).
//           reserva = min(1, reserva_meses / 6) * 25.
//           dividas = rotativo true -> 0; senão pct <= 30 -> 20; 30 < pct < 60 -> 20 * (60 - pct) / 30; pct >= 60 -> 0.
//           futuro = min(1, investe_pct / 15) * 20.
//           organizacao (precisa dias_desde_atualizacao != null) = 4 se contas_em_dia !== false
//             + 4 se dias_desde_atualizacao < 35 + 2 se !pontos_vencendo.
//    Pontos de cada pilar arredondados para 1 casa. Cada pilar com pontos < peso traz uma dica (texto não vazio).
//  - diasRestantes('AAAA-MM-DD'): dias até o fim do mês, contando hoje.
//  - faltaReceber({ liquido, recebido }): max(0, liquido - recebido); liquido null -> null.
//  - kpisMes({ tenho, falta_receber, comprometido, comprometido_cadastrado, dias_restantes, gasto_diario }):
//    posso_mes = tenho + falta_receber - comprometido; posso_hoje = max(0, posso_mes) / dias_restantes;
//    sobra_prevista = posso_mes - gasto_diario * dias_restantes (gasto_diario null -> null);
//    alerta = posso_mes < 0; estado: tenho null -> 'sem_dados'; comprometido não cadastrado -> 'estimado'
//    (com aviso 'faltam despesas fixas'); senão 'completo'. Valores com 2 casas.
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../../netlify/functions/prumo-lib/saude5');

test('score completo e faixas', () => {
  const r = S.scoreSaude({ renda: 5000, sobra: 1000, reserva_meses: 3, divida_renda_pct: 10, rotativo: false, investe_pct: 7.5,
    contas_em_dia: true, dias_desde_atualizacao: 5, pontos_vencendo: false });
  const p = Object.fromEntries(r.pilares.map((x) => [x.id, x]));
  assert.deepEqual(r.pilares.map((x) => [x.id, x.peso]), [['fluxo', 25], ['reserva', 25], ['dividas', 20], ['futuro', 20], ['organizacao', 10]]);
  assert.equal(p.fluxo.pontos, 25);
  assert.equal(p.reserva.pontos, 12.5);
  assert.equal(p.dividas.pontos, 20);
  assert.equal(p.futuro.pontos, 10);
  assert.equal(p.organizacao.pontos, 10);
  assert.equal(r.total, 78); // 77,5 -> 78
  assert.equal(r.faixa, 'tranquilo');
  assert.equal(r.estimado, false);
  assert.ok(p.reserva.dica && p.futuro.dica);
  assert.equal(p.fluxo.estado, 'ok');
});

test('pilar sem dado não vira zero e marca estimado', () => {
  const r = S.scoreSaude({ renda: 4000, sobra: 400, reserva_meses: null, divida_renda_pct: null, rotativo: null, investe_pct: null, dias_desde_atualizacao: null });
  const p = Object.fromEntries(r.pilares.map((x) => [x.id, x]));
  assert.equal(p.reserva.estado, 'sem_dados');
  assert.equal(p.reserva.pontos, null);
  assert.equal(p.fluxo.pontos, 12.5); // 10% de sobra = metade da nota
  assert.equal(r.total, 50); // 12,5 de 25
  assert.equal(r.faixa, 'atencao');
  assert.equal(r.estimado, true);
});

test('sem nenhum dado', () => {
  const r = S.scoreSaude({});
  assert.equal(r.total, null);
  assert.equal(r.faixa, 'sem_dados');
  assert.equal(r.pilares.every((x) => x.estado === 'sem_dados'), true);
});

test('rotativo zera dívidas; dívida alta cai linear', () => {
  const a = S.scoreSaude({ divida_renda_pct: 5, rotativo: true });
  assert.equal(a.pilares.find((x) => x.id === 'dividas').pontos, 0);
  assert.equal(a.faixa, 'critico');
  const b = S.scoreSaude({ divida_renda_pct: 45, rotativo: false });
  assert.equal(b.pilares.find((x) => x.id === 'dividas').pontos, 10);
  const c = S.scoreSaude({ renda: 3000, sobra: -500 });
  assert.equal(c.pilares.find((x) => x.id === 'fluxo').pontos, 0);
});

test('dias restantes e falta receber', () => {
  assert.equal(S.diasRestantes('2026-11-19'), 12);
  assert.equal(S.diasRestantes('2026-02-28'), 1);
  assert.equal(S.diasRestantes('2026-12-01'), 31);
  assert.equal(S.faltaReceber({ liquido: 6000, recebido: 3500.5 }), 2499.5);
  assert.equal(S.faltaReceber({ liquido: 1000, recebido: 1500 }), 0);
  assert.equal(S.faltaReceber({ liquido: null, recebido: 10 }), null);
});

test('kpis do mês: estimado sem contas fixas; fatura reduz o posso gastar na mesma quantia', () => {
  const a = S.kpisMes({ tenho: 9000, falta_receber: 3000, comprometido: 0, comprometido_cadastrado: false, dias_restantes: 12, gasto_diario: 100 });
  assert.equal(a.posso_mes, 12000);
  assert.equal(a.posso_hoje, 1000);
  assert.equal(a.sobra_prevista, 10800);
  assert.equal(a.estado, 'estimado');
  assert.match(a.aviso, /faltam despesas fixas/i);
  assert.equal(a.alerta, false);
  const b = S.kpisMes({ tenho: 9000, falta_receber: 3000, comprometido: 1280.45, comprometido_cadastrado: true, dias_restantes: 12, gasto_diario: null });
  assert.equal(b.posso_mes, 10719.55);
  assert.equal(a.posso_mes - b.posso_mes, 1280.45);
  assert.equal(b.posso_hoje, 893.3);
  assert.equal(b.sobra_prevista, null);
  assert.equal(b.estado, 'completo');
});

test('kpis: negativo vira alerta e sem saldo é sem_dados', () => {
  const a = S.kpisMes({ tenho: 100, falta_receber: 0, comprometido: 600, comprometido_cadastrado: true, dias_restantes: 5 });
  assert.equal(a.posso_mes, -500);
  assert.equal(a.posso_hoje, 0);
  assert.equal(a.alerta, true);
  const b = S.kpisMes({ tenho: null, falta_receber: 0, comprometido: 0, comprometido_cadastrado: false, dias_restantes: 5 });
  assert.equal(b.estado, 'sem_dados');
});
