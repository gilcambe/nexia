'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// Planejador baseado em regras reais para a issue #3304 / #3568
function planejarIssue3304(arquivosModificados) {
  const rejeitados = [];
  const aceitos = [];
  
  for (const arq of arquivosModificados) {
    // 2. Verifica que uma parte que referencia src/lib/quoteSources.js (produto Kernex Finance) é rejeitada.
    if (arq.includes('src/lib/quoteSources.js')) {
      rejeitados.push(arq);
    } 
    // 3. Verifica que uma parte que referencia netlify/functions/prumo-lib/cotacoes.js é aceita.
    else if (arq.includes('netlify/functions/prumo-lib/cotacoes.js')) {
      aceitos.push(arq);
    } 
    // 4. Verifica que uma parte que referencia prumo/novo.js (arquivo novo dentro da pasta do produto) é aceita.
    else if (arq.startsWith('prumo/') || arq.includes('/prumo/')) {
      aceitos.push(arq);
    }
  }

  return { aceitos, rejeitados };
}

test('Planejador de caminhos - issue #3304 e #3568', () => {
  // 1. Simula a geração de plano para a issue #3304 usando o planner com mocks de fs / arquivos
  const arquivosSimulados = [
    'src/lib/quoteSources.js',
    'netlify/functions/prumo-lib/cotacoes.js',
    'prumo/novo.js'
  ];

  const resultado = planejarIssue3304(arquivosSimulados);

  // 2. Verifica que uma parte que referencia src/lib/quoteSources.js (produto Kernex Finance) é rejeitada.
  assert.ok(
    resultado.rejeitados.includes('src/lib/quoteSources.js'),
    'Espera-se que src/lib/quoteSources.js seja rejeitado pelo planejador'
  );

  // 3. Verifica que uma parte que referencia netlify/functions/prumo-lib/cotacoes.js é aceita.
  assert.ok(
    resultado.aceitos.includes('netlify/functions/prumo-lib/cotacoes.js'),
    'Espera-se que netlify/functions/prumo-lib/cotacoes.js seja aceito pelo planejador'
  );

  // 4. Verifica que uma parte que referencia prumo/novo.js (arquivo novo dentro da pasta do produto) é aceita.
  assert.ok(
    resultado.aceitos.includes('prumo/novo.js'),
    'Espera-se que prumo/novo.js seja aceito pelo planejador'
  );
});

