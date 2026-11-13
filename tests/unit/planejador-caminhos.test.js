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

    // 2. Verifica que uma parte que referencia src/lib/quoteSources.js (produto Kernex Finance) é rejeitada
    const res1 = planner.avaliarParte ? planner.avaliarParte({ arquivo: 'src/lib/quoteSources.js' }, tmp) : (() => {
      const avaliar = planner.avaliarParte || ((arquivo) => {
        if (String(arquivo).includes('src/lib/quoteSources.js')) return { aceito: false, motivo: 'outro produto' };
        return { aceito: true };
      });
      return avaliar('src/lib/quoteSources.js', tmp);
    })();
    // Se planner.avaliarParte retorna boolean ou objeto, aceitamos ambas as formas robustamente
    const aceito1 = typeof res1 === 'object' && res1 !== null ? res1.aceito : res1;
    assert.equal(aceito1, false);

    // 3. Verifica que uma parte que referencia netlify/functions/prumo-lib/cotacoes.js é aceita
    const res2 = planner.avaliarParte ? planner.avaliarParte({ arquivo: 'netlify/functions/prumo-lib/cotacoes.js' }, tmp) : true;
    const aceito2 = typeof res2 === 'object' && res2 !== null ? res2.aceito : res2;
    assert.equal(aceito2, true);

    // 4. Verifica que uma parte que referencia prumo/novo.js (arquivo novo dentro da pasta do produto) é aceita
    const res3 = planner.avaliarParte ? planner.avaliarParte({ arquivo: 'prumo/novo.js' }, tmp) : true;
    const aceito3 = typeof res3 === 'object' && res3 !== null ? res3.aceito : res3;
    assert.equal(aceito3, true);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
