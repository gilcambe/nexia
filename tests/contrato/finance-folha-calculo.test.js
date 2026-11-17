'use strict';
// Contrato: Kernex Finance — CÁLCULO DA FOLHA 2026 (dono 17/11: "recebo duas vezes ao mês... o holerite só vem
// completo no final do mês... quando eu colocar o print da folha de ponto ele estimar quanto receberei").
// Novo arquivo netlify/functions/prumo-lib/folha.js, SÓ cálculo (sem banco, sem IA), exportando:
//   TABELAS_2026, inss(bruto), irrf({ rendimento, inss, dependentes = 0 }), diasDoMes('AAAA-MM'),
//   estimarFechamento({ mes, salario_base, jornada_mensal = 220, dependentes = 0, ponto = {}, recebidos = [] })
// Tabelas OFICIAIS 2026 (não invente outras; guarde a fonte em comentário):
//  - INSS (Portaria Interministerial MPS/MF nº 13/2026), progressivo por faixa, teto R$ 8.475,55:
//      até 1.621,00: 7,5% | até 2.902,84: 9% | até 4.354,27: 12% | até 8.475,55: 14% (acima do teto não desconta mais)
//  - IRRF mensal (tabela progressiva, base = rendimento − MAIOR entre {inss + 189,59 × dependentes} e 607,20):
//      até 2.428,80: 0 | até 2.826,65: 7,5% − 182,16 | até 3.751,05: 15% − 394,16 | até 4.664,68: 22,5% − 675,49 |
//      acima: 27,5% − 908,73
//    Redutor da Lei 15.270/2025 (sobre o RENDIMENTO bruto tributável): até 5.000,00 → imposto − 312,89 (mínimo 0);
//    de 5.000,01 a 7.350,00 → imposto − (978,62 − 0,133145 × rendimento) (mínimo 0); acima: sem redutor.
//  - Arredonde cada valor final a 2 casas.
// diasDoMes(mes) -> { uteis, descanso }: descanso = domingos + feriados NACIONAIS de 2026 que não caem em domingo
//   (01/01, 03/04 Sexta-feira Santa, 21/04, 01/05, 07/09, 12/10, 02/11, 15/11, 20/11, 25/12); uteis = dias do mês − descanso.
// estimarFechamento: valor_hora = salario_base ÷ jornada_mensal;
//   horas extras = valor_hora × 1,5 × ponto.he50 + valor_hora × 2 × ponto.he100; adicional noturno = valor_hora × 0,2 ×
//   ponto.noturnas; DSR = (horas extras + adicional noturno) × descanso ÷ uteis; faltas = valor_hora × ponto.faltas;
//   bruto = salario_base + horas extras + noturno + DSR − faltas; inss = inss(bruto); irrf = irrf(...);
//   liquido = bruto − inss − irrf; ja_recebido = soma de recebidos com tipo 'adiantamento' (o 13º é pago à parte e NÃO
//   entra); a_receber = liquido − ja_recebido. Devolva { bruto, inss, irrf, liquido, ja_recebido, a_receber, dsr,
//   valor_hora, linhas: [{ nome, valor }], aproximado: true, aviso } — aviso em português simples dizendo que é
//   estimativa (convênios, plano de saúde, VT e outros descontos da empresa não entram).
const test = require('node:test');
const assert = require('node:assert/strict');
const f = require('../../netlify/functions/prumo-lib/folha');
const perto = (a, b, msg) => assert.ok(Math.abs(a - b) <= 0.02, `${msg}: ${a} ≠ ${b}`);

test('INSS 2026 progressivo e com teto', () => {
  perto(f.inss(1621), 121.58, 'salário mínimo');
  perto(f.inss(3000), 248.60, 'R$ 3.000');
  perto(f.inss(5000), 501.51, 'R$ 5.000');
  perto(f.inss(8868.69), 988.09, 'acima do teto = máximo');
  perto(f.inss(20000), 988.09, 'muito acima do teto');
});

test('IRRF 2026 com o redutor da Lei 15.270/2025', () => {
  perto(f.irrf({ rendimento: 4800, inss: f.inss(4800) }), 0, 'até 5 mil: zerado');
  perto(f.irrf({ rendimento: 6000, inss: f.inss(6000) }), 385.10, 'R$ 6.000 (redução de 179,75)');
  perto(f.irrf({ rendimento: 8868.69, inss: 988.09 }), 1258.44, 'acima de 7.350: sem redutor');
  perto(f.irrf({ rendimento: 3000, inss: f.inss(3000), dependentes: 1 }), 0, 'com dependente');
});

test('dias úteis e de descanso (domingos + feriados nacionais)', () => {
  assert.deepEqual(f.diasDoMes('2026-11'), { uteis: 23, descanso: 7 });
  assert.deepEqual(f.diasDoMes('2026-12'), { uteis: 26, descanso: 5 });
  assert.deepEqual(f.diasDoMes('2026-02'), { uteis: 24, descanso: 4 });
});

test('fechamento do mês: só salário, com adiantamento já recebido (13º não conta)', () => {
  const r = f.estimarFechamento({ mes: '2026-11', salario_base: 8868.69, recebidos: [{ tipo: 'adiantamento', liquido: 4434.35 }, { tipo: 'decimo_terceiro_1', liquido: 5883.37 }] });
  perto(r.bruto, 8868.69, 'bruto'); perto(r.inss, 988.09, 'inss'); perto(r.irrf, 1258.44, 'irrf');
  perto(r.liquido, 6622.16, 'líquido do mês'); perto(r.ja_recebido, 4434.35, 'só o adiantamento');
  perto(r.a_receber, 2187.81, 'a receber no fechamento');
  assert.equal(r.aproximado, true);
  assert.match(r.aviso, /estimativa/i);
  assert.ok(Array.isArray(r.linhas) && r.linhas.some((l) => /INSS/i.test(l.nome)));
});

test('fechamento com folha de ponto: horas extras, noturno, DSR e faltas', () => {
  const a = f.estimarFechamento({ mes: '2026-11', salario_base: 8868.69, ponto: { he50: 10 }, recebidos: [{ tipo: 'adiantamento', liquido: 4434.35 }] });
  perto(a.dsr, 184.03, 'DSR'); perto(a.bruto, 9657.41, 'bruto'); perto(a.irrf, 1475.33, 'irrf'); perto(a.a_receber, 2759.64, 'a receber');
  const b = f.estimarFechamento({ mes: '2026-11', salario_base: 8868.69, ponto: { he50: 4, he100: 2, noturnas: 8, faltas: 8 }, recebidos: [{ tipo: 'adiantamento', liquido: 4434.35 }] });
  perto(b.dsr, 142.32, 'DSR'); perto(b.bruto, 9156.13, 'bruto'); perto(b.irrf, 1337.48, 'irrf'); perto(b.a_receber, 2396.21, 'a receber');
});
