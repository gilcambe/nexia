const assert = require('assert');
const { idDe, normalizarLancamento, LER_DOC } = require('../netlify/functions/prumo-lib/documentos');

// Teste 1: Dados dos prints reais
const faturaItau1 = {
  data: '2026-12-06',
  descricao: 'Fatura Itaú Black final 6651',
  valor: 609.15,
  tipo: 'pagamento_fatura',
  conta_ou_cartao: 'final 6651',
  vencimento: '2026-12-06'
};

const faturaItau2 = {
  data: '2026-12-06',
  descricao: 'Fatura Itaú Black final 6651',
  valor: 609.15,
  tipo: 'pagamento_fatura',
  conta_ou_cartao: 'final 6651',
  vencimento: '2026-12-06'
};

// Teste idempotência
const id1 = idDe(normalizarLancamento(faturaItau1).item);
const id2 = idDe(normalizarLancamento(faturaItau2).item);

console.log('Testando idempotência...');
assert.strictEqual(id1, id2, 'IDs de faturas iguais devem ser idênticos');
console.log('IDempotência OK:', id1);

// Teste normalização
const norm = normalizarLancamento(faturaItau1);
assert.ok(norm.ok, 'Normalização deve funcionar');
assert.strictEqual(norm.item.valor, 609.15);
assert.strictEqual(norm.item.vencimento, '2026-12-06');
console.log('Normalização OK');
