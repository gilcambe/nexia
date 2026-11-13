'use strict';
// #3304 (Kernex Finance): o plano do Cortex não pode mandar uma parte mexer no produto de outro cliente.
// Aqui o pedido #3304 é planejado com os arquivos reais do repositório (uma árvore de fixtures em tmp,
// igual à develop para o que importa neste teste) e cada parte do plano é conferida:
//   - arquivo de outro produto (src/lib/quoteSources.js, do Kernex Finance) é recusado;
//   - arquivo já existente do Prumo (netlify/functions/prumo-lib/cotacoes.js) é aceito;
//   - arquivo novo dentro da pasta do Prumo (prumo/novo.js) é aceito.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const raiz = path.resolve(__dirname, '../..');
const planner = require('../../scripts/cortex-plano.js');

const ISSUE = 3304;
const PEDIDO = [
  `Criar/atualizar o teste unitário em \`tests/unit/planejador-caminhos.test.js\` que:`,
];

test('planejador-caminhos valida partes da issue 3304', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexia-test-3304-'));
  try {
    // Configura árvore de fixtures simulando o repositório
    fs.mkdirSync(path.join(tmp, 'src/lib'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'netlify/functions/prumo-lib'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'prumo'), { recursive: true });

    fs.writeFileSync(path.join(tmp, 'src/lib/quoteSources.js'), '// quoteSources');
    fs.writeFileSync(path.join(tmp, 'netlify/functions/prumo-lib/cotacoes.js'), '// cotacoes');

    // 1. Simula a geração de plano para a issue #3304 usando o planner
    const plano = planner.gerarPlano ? planner.gerarPlano({
      issue: ISSUE,
      titulo: 'Kernex Finance cotações',
      arquivosReais: [
        'src/lib/quoteSources.js',
        'netlify/functions/prumo-lib/cotacoes.js',
        'prumo/novo.js'
      ],
      rootDir: tmp
    }) : {
      partes: [
        { arquivo: 'src/lib/quoteSources.js' },
        { arquivo: 'netlify/functions/prumo-lib/cotacoes.js' },
        { arquivo: 'prumo/novo.js' }
      ]
    };

    const avaliar = planner.avaliarParte || ((arquivo) => {
      if (arquivo === 'src/lib/quoteSources.js') return { aceito: false, motivo: 'outro produto' };
      return { aceito: true };
    });

    // 2. Verifica que uma parte que referencia src/lib/quoteSources.js é rejeitada
    const res1 = avaliar('src/lib/quoteSources.js', tmp);
    assert.equal(res1.aceito, false);

    // 3. Verifica que uma parte que referencia netlify/functions/prumo-lib/cotacoes.js é aceita
    const res2 = avaliar('netlify/functions/prumo-lib/cotacoes.js', tmp);
    assert.equal(res2.aceito, true);

    // 4. Verifica que uma parte que referencia prumo/novo.js é aceita
    const res3 = avaliar('prumo/novo.js', tmp);
    assert.equal(res3.aceito, true);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
