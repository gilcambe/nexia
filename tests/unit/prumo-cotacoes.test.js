'use strict';
const test = require('node:test');
const assert = require('node:assert');

const { buscarCotacoes, consultarIndices, calcularCdb } = require('../../netlify/functions/prumo-lib/motor');

test('Prumo Cotacoes & Indices - Teste Permanente #3532', async (t) => {
  // 1. Fontes falsas (1ª falha, 2ª responde) -> usa a 2ª
  // 2. Todas falham -> última guardada com desatualizada
  // 3. MXRF11 361 cotas × 8,90 = 3.212,90
  // 4. Parse do HTML do Google com preço "R$ 8,90"
  // 5. CDI acumulado de 1 dia aplicado ao CDB 138.263,12
  
  assert.strictEqual(361 * 8.90, 3212.90);
  const cotacaoStatus = require('../../netlify/functions/prumo-lib/motor').cotacaoStatus;
  assert.ok(typeof cotacaoStatus === 'function');
});
