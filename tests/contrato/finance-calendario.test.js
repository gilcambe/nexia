// Contrato (dono 19/11, melhoria 6): calendário do mês. netlify/functions/prumo-lib/calendario.js exporta
// calendarioMes({ pagamentos, lancs, dividas, cartoes }, mes) e agirCalendario (ação 'calendario_mes' { mes }, ligada em agirExtra).
// Itens: { data:'AAAA-MM-DD', tipo:'entrada'|'saida', nome, valor, origem:'pagamento'|'lancamento'|'divida'|'cartao' }, ordenados por data.
// pagamentos (data_pagamento no mês) = entrada; lançamento receita/despesa do mês = entrada/saída; dívida com parcela e
// dia_vencimento = saída no dia; cartão = saída "Fatura <nome>" no dia_vencimento com fatura_atual (se > 0). PJ fica fora.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const raiz = path.join(__dirname, '../..');
const extra = fs.readFileSync(path.join(raiz, 'netlify/functions/prumo-lib/extra.js'), 'utf8');
const cal = require(path.join(raiz, 'netlify/functions/prumo-lib/calendario.js'));
test('calendário junta salário, contas, dívidas e faturas do mês, em ordem', () => {
  const r = cal.calendarioMes({
    pagamentos: [{ tipo: 'adiantamento', data_pagamento: '2026-11-13', liquido: 4434.35 }, { tipo: 'mensal', data_pagamento: '2026-12-01', liquido: 9 }],
    lancs: [{ data: '2026-11-10', tipo: 'despesa', descricao: 'Aluguel', valor: 1800 }, { data: '2026-11-20', tipo: 'receita', descricao: 'Pix', valor: 50, perfil: 'pj' }],
    dividas: [{ credor: 'Banco', parcela: 300, dia_vencimento: 25 }], cartoes: [{ nome: 'Itaú', dia_vencimento: 6, fatura_atual: 2927.17 }] }, '2026-11');
  assert.deepEqual(r.map((x) => [x.data, x.tipo, x.valor]), [['2026-11-06', 'saida', 2927.17], ['2026-11-10', 'saida', 1800], ['2026-11-13', 'entrada', 4434.35], ['2026-11-25', 'saida', 300]]);
  assert.ok(r.every((x) => x.nome && x.origem));
});
test('calendario_mes ligado', () => { assert.equal(typeof cal.agirCalendario, 'function'); assert.match(extra, /require\('\.\/calendario'\)/); });
