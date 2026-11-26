
const assert = require('assert');
const { faturaDoMes } = require('../../netlify/functions/prumo-lib/cartoes');

describe('Kernex Finance - Faturas', () => {
  it('deve somar faturas corretamente de gastos com cartão', () => {
    const gastos = [
      { cartao_id: 'itau-1888', valor: 3020.13, data: '2026-12-06', parcelas: 1 },
      { cartao_id: 'itau-6651', valor: 609.15, data: '2026-12-10', parcelas: 1 }
    ];
    
    // Itaú Uniclass Infini final 1888
    assert.strictEqual(faturaDoMes(gastos, 'itau-1888', '2026-12'), 3020.13);
    
    // Itaú Uniclass Black final 6651
    assert.strictEqual(faturaDoMes(gastos, 'itau-6651', '2026-12'), 609.15);
  });

  it('não deve duplicar faturas ao reenviar o mesmo print', () => {
    // A lógica de conciliação no documentos.js deve impedir isso com idDe(l)
    const { idDe } = require('../../netlify/functions/prumo-lib/documentos');
    const item1 = { data: '2026-12-06', valor: 3020.13, descricao: 'Fatura Itaú 1888', conta_ou_cartao: '1888', tipo: 'pagamento_fatura' };
    const item2 = { data: '2026-12-06', valor: 3020.13, descricao: 'Fatura Itaú 1888', conta_ou_cartao: '1888', tipo: 'pagamento_fatura' };
    
    assert.strictEqual(idDe(item1), idDe(item2), 'IDs devem ser idênticos para evitar duplicidade');
  });
});
