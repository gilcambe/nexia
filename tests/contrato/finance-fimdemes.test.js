// Contrato (melhorias 14 e 17): saldo previsto no fim do mês e quanto posso gastar HOJE.
// netlify/functions/prumo-lib/fimdemes.js exporta fimDoMes({ saldo, a_receber, a_pagar, gasto_diario, hoje }) e agirFimDoMes
// (ação 'fim_mes_previsao', ligada em agirExtra: saldo = contas; a_receber/a_pagar = previsto.resumoPrevisto do mês;
// gasto_diario = despesas realizadas dos últimos 30 dias / 30).
// dias_restantes = do dia seguinte a hoje até o último dia do mês; saldo_fim = saldo + a_receber − a_pagar − gasto_diario*dias_restantes;
// pode_hoje = max(0, (saldo − a_pagar) / (dias_restantes + 1)). Centavos certos. Sem saldo (null): saldo_fim e pode_hoje null.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const raiz = path.join(__dirname, '../..');
const extra = fs.readFileSync(path.join(raiz, 'netlify/functions/prumo-lib/extra.js'), 'utf8');
const fm = require(path.join(raiz, 'netlify/functions/prumo-lib/fimdemes.js'));
test('previsão do fim do mês e gasto de hoje', () => {
  const r = fm.fimDoMes({ saldo: 4000, a_receber: 3000, a_pagar: 1000, gasto_diario: 100, hoje: '2026-11-20' });
  assert.equal(r.dias_restantes, 10); assert.equal(r.saldo_fim, 5000); assert.equal(r.pode_hoje, 272.73); assert.equal(r.ate, '2026-11-30');
});
test('sem saldo e nunca negativo', () => {
  assert.equal(fm.fimDoMes({ saldo: null, a_receber: 0, a_pagar: 0, gasto_diario: 0, hoje: '2026-11-30' }).pode_hoje, null);
  assert.equal(fm.fimDoMes({ saldo: 100, a_receber: 0, a_pagar: 500, gasto_diario: 0, hoje: '2026-11-30' }).pode_hoje, 0);
});
test('ação ligada', () => { assert.match(extra, /require\('\.\/fimdemes'\)/); });
