const assert = require('assert');
const { normalizarLancamento, idDe, CATEGORIAS_KF, agirDoc } = require('../netlify/functions/prumo-lib/documentos');

// Testes de leitura dos prints do Itaú
const itauUniclassInfini = {
  tipo_documento: 'fatura',
  instituicao: 'Itaú Uniclass',
  lancamentos: [
    {
      data: '2026-12-06',
      descricao: 'Fatura Aberta Itaú Uniclass Infini final 18',
      estabelecimento: 'Itaú Uniclass',
      valor: 3020.13,
      tipo: 'pagamento_fatura',
      vencimento: '2026-12-06',
      conta_ou_cartao: 'final 18'
    }
  ]
};

const itauUniclassBlack = {
  tipo_documento: 'fatura',
  instituicao: 'Itaú Uniclass',
  lancamentos: [
    {
      data: '2026-12-10',
      descricao: 'Fatura Aberta Itaú Uniclass Black final 6651',
      estabelecimento: 'Itaú Uniclass',
      valor: 609.15,
      tipo: 'pagamento_fatura',
      vencimento: '2026-12-10',
      conta_ou_cartao: 'final 6651'
    }
  ]
};

async function testLeituraFatura() {
  console.log('Testando leitura de fatura...');
  
  const { listar, base } = require('./db/mock'); // Ajustado para ambiente de teste

// Testar normalização
  const lanc1 = normalizarLancamento(itauUniclassInfini.lancamentos[0], itauUniclassInfini);
  assert.strictEqual(lanc1.ok, true, 'Deve normalizar lançamento do Infini');
  assert.strictEqual(lanc1.item.valor, 3020.13);
  
  const lanc2 = normalizarLancamento(itauUniclassBlack.lancamentos[0], itauUniclassBlack);
  assert.strictEqual(lanc2.ok, true, 'Deve normalizar lançamento do Black');
  assert.strictEqual(lanc2.item.valor, 609.15);

  // Testar IDs únicos
  const id1a = idDe(lanc1.item);
  const id1b = idDe(lanc1.item);
  assert.strictEqual(id1a, id1b, 'ID deve ser consistente para o mesmo lançamento');

  console.log('Testes de leitura passaram!');
}

testLeituraFatura().catch(e => { console.error(e); process.exit(1); });
