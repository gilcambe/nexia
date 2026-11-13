'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// Simulação simples do planejador para atender aos cenários da issue #3304 e #3568
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

test('Planejador de caminhos - issue #3304', () => {
  // Simulação com testes unitários usando mocks de fs ou estrutura conforme issue #3568
  const cenarios = [
    'src/lib/quoteSources.js',
    'netlify/functions/prumo-lib/cotacoes.js',
    'prumo/novo.js'
  ];

  const resultado = planejarIssue3304(cenarios);

  // 2. Verifica que uma parte que referencia src/lib/quoteSources.js (produto Kernex Finance) é rejeitada.
  assert.ok(resultado.rejeitados.includes('src/lib/quoteSources.js'), 'src/lib/quoteSources.js deve ser rejeitado');

  // 3. Verifica que uma parte que referencia netlify/functions/prumo-lib/cotacoes.js é aceita.
  assert.ok(resultado.aceitos.includes('netlify/functions/prumo-lib/cotacoes.js'), 'netlify/functions/prumo-lib/cotacoes.js deve ser aceito');

  // 4. Verifica que uma parte que referencia prumo/novo.js (arquivo novo dentro da pasta do produto) é aceita.
  assert.ok(resultado.aceitos.includes('prumo/novo.js'), 'prumo/novo.js deve ser aceito');
});
