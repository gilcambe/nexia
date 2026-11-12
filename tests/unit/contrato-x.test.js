const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// Importa o módulo a ser testado usando caminho relativo ao diretório deste teste
const produtos = require(path.join(__dirname, '../../nexia-ai/orchestrator/produtos.js'));

test('produtos.js exporta o mapa de produto correto', (t) => {
  // Caso comum: verifica o mapeamento completo de "Kernex Finance"
  assert.deepStrictEqual(
    produtos['Kernex Finance'],
    [
      'prumo/',
      'netlify/functions/prumo',
      'netlify/functions/prumo-lib',
      'tests/unit/prumo-'
    ]
  );

  // Outro caso válido: verifica o mapeamento de "Central/Cortex"
  assert.deepStrictEqual(produtos['Central/Cortex'], ['src/']);

  // Caso de borda: produto que não está no mapa deve resultar em undefined
  assert.strictEqual(produtos['Produto Inexistente'], undefined);

  // Assegura que todas as chaves são strings e todos os valores são arrays (garantia estrutural)
  for (const key of Object.keys(produtos)) {
    assert.ok(typeof key === 'string', `Chave ${key} não é string`);
    assert.ok(Array.isArray(produtos[key]), `Valor para ${key} não é array`);
  }
});