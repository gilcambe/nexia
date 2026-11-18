'use strict';
// 18/11: holerite MENSAL real do dono (out/2026, Avaya/ADP). Valores reais: base 8.446,37; triênio 179,00;
// DSR 558,92; HE75 0,57 h = 38,30; HE100 0,15 h = 11,52; BIP (sobreaviso) 72 h = 921,33; noturno 30% 168,02 h =
// 1.935,22; ajuda home office 100,00; adiantamento 4.223,19; prev. 422,32 + 422,32; IR 1.912,21; INSS 988,07;
// VA 77,00; LÍQUIDO 4.145,55. Regra: o perfil aprendido desse holerite faz a estimativa bater (± R$ 5).
const test = require('node:test');
const assert = require('node:assert/strict');
const folha = require('../../netlify/functions/prumo-lib/folha.js');
const { perfilDoHolerite } = require('../../netlify/functions/prumo-lib/salario.js');

const OUT = { tipo: 'mensal', mes: '2026-10', salario_base: 8446.37,
  proventos: [{ nome: 'Salário Base', valor: 8446.37 }, { nome: 'Triênio', valor: 179 }, { nome: 'DSR (H.E./Adic.Not.)', valor: 558.92 }, { nome: 'Horas Extras - 75%', valor: 38.3 }, { nome: 'Horas Extras - 100%', valor: 11.52 }, { nome: 'Adicional BIP', valor: 921.33 }, { nome: 'Adic. Noturno - 30%', valor: 1935.22 }, { nome: 'AJUDA DE CUSTO PARA HOME OFFICE', valor: 100 }],
  descontos: [{ nome: 'Adiant Quinzenal', valor: 4223.19 }, { nome: 'Ctb. Prev. Básica_Cat 2', valor: 422.32 }, { nome: 'Ctb. Prev. Voluntária_Cat 2', valor: 422.32 }, { nome: 'IR Retido', valor: 1912.21 }, { nome: 'INSS', valor: 988.07 }, { nome: 'Vale Alimentação', valor: 77 }] };

test('aprende o perfil da folha do holerite mensal', () => {
  const pf = perfilDoHolerite(OUT);
  assert.deepEqual(pf, { noturno_pct: 30, fixos: 179, nao_tributavel: 100, prev_pct: 10, descontos_fixos: 77 });
  assert.equal(perfilDoHolerite({ ...OUT, tipo: 'adiantamento' }), null, 'só o mensal ensina');
});

test('com o perfil, a estimativa de out/2026 bate com o holerite real', () => {
  const r = folha.estimarFechamento({ mes: '2026-10', salario_base: 8446.37, ponto: { he75: 0.57, he100: 0.15, noturnas: 168.02, sobreaviso: 72 },
    recebidos: [{ tipo: 'adiantamento', liquido: 4223.19 }], perfil: perfilDoHolerite(OUT) });
  const l = (n) => (r.linhas.find((x) => x.nome === n) || {}).valor;
  assert.ok(Math.abs(l('Adicional noturno') - 1935.22) < 1, `noturno ${l('Adicional noturno')}`);
  assert.ok(Math.abs(l('Sobreaviso') - 921.33) < 1, `sobreaviso ${l('Sobreaviso')}`);
  assert.ok(Math.abs(l('DSR') - 558.92) < 2, `DSR ${l('DSR')}`);
  assert.ok(Math.abs(r.inss - 988.07) < 1, `INSS ${r.inss}`);
  assert.ok(Math.abs(r.irrf - 1912.21) < 5, `IR ${r.irrf}`);
  assert.ok(Math.abs(r.a_receber - 4145.55) < 5, `a receber ${r.a_receber} (real 4.145,55)`);
});
