'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  parseArgs,
  percentile,
  tempoAleatorio,
  executarCarga,
  salvarRelatorio,
} = require('../../scripts/cortex-carga');

test('CARGA1. parseArgs lê flags --falso, --real e --pessoas corretamente', () => {
  const argsFalso = parseArgs(['--falso', '--pessoas', '200']);
  assert.equal(argsFalso.modo, 'falso');
  assert.equal(argsFalso.pessoas, 200);

  const argsReal = parseArgs(['--real', '--pessoas', '1000']);
  assert.equal(argsReal.modo, 'real');
  assert.equal(argsReal.pessoas, 1000);

  const argsDefault = parseArgs(['--falso']);
  assert.equal(argsDefault.modo, 'falso');
  assert.equal(argsDefault.pessoas, 50);

  const argsSemModo = parseArgs([]);
  assert.equal(argsSemModo.modo, null);
});

test('CARGA2. percentile calcula p50 e p95 com precisão', () => {
  assert.equal(percentile([], 50), 0);
  const valores = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  assert.equal(percentile(valores, 50), 50);
  assert.equal(percentile(valores, 95), 100);
});

test('CARGA3. modo --falso gera métricas sem erro 5xx e com p95 < 3s', async () => {
  const relatorio = await executarCarga({ modo: 'falso', pessoas: 50 });

  assert.equal(relatorio.modo, 'falso');
  assert.equal(relatorio.pessoas, 50);
  assert.equal(relatorio.errorRate, 0);
  assert.equal(relatorio.totalErros5xx, 0);
  assert.ok(relatorio.p95 < 3000, `p95 deve ser menor que 3000ms, recebido: ${relatorio.p95}`);
  assert.ok(relatorio.p50 > 0, 'p50 deve ser maior que 0');
  assert.equal(relatorio.providerBreakdown.simulado, 50);
  assert.ok(relatorio.geradoEm);
});

test('CARGA4. salvarRelatorio cria arquivo JSON válido com padrão carga-relatorio-*.json', () => {
  const fakeRelatorio = {
    modo: 'falso',
    pessoas: 10,
    p50: 100,
    p95: 250,
    totalTime: 120,
    errorRate: 0,
    queueRate: 0,
    providerBreakdown: { simulado: 10 },
    geradoEm: new Date().toISOString(),
  };

  const arquivo = salvarRelatorio(fakeRelatorio);
  try {
    assert.ok(arquivo.startsWith('carga-relatorio-') && arquivo.endsWith('.json'));
    assert.ok(fs.existsSync(arquivo));
    const conteudo = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
    assert.equal(conteudo.modo, 'falso');
    assert.equal(conteudo.pessoas, 10);
  } finally {
    if (fs.existsSync(arquivo)) {
      fs.unlinkSync(arquivo);
    }
  }
});

test('CARGA5. workflow .github/workflows/cortex-carga.yml possui entradas e timeout esperados', () => {
  const workflowPath = path.join(__dirname, '../../.github/workflows/cortex-carga.yml');
  assert.ok(fs.existsSync(workflowPath), 'Workflow deve existir');
  const conteudo = fs.readFileSync(workflowPath, 'utf8');

  assert.ok(conteudo.includes('workflow_dispatch:'), 'Deve ter trigger workflow_dispatch');
  assert.ok(conteudo.includes("timeout-minutes: 20"), 'Deve ter timeout de 20 minutos');
  assert.ok(conteudo.includes("pessoas:"), 'Deve aceitar entrada pessoas');
  assert.ok(conteudo.includes("modo:"), 'Deve aceitar entrada modo');
  assert.ok(conteudo.includes("50"), 'Opção 50');
  assert.ok(conteudo.includes("200"), 'Opção 200');
  assert.ok(conteudo.includes("1000"), 'Opção 1000');
  assert.ok(conteudo.includes("scripts/cortex-carga.js"), 'Executa scripts/cortex-carga.js');
  assert.ok(conteudo.includes("carga-relatorio-*.json"), 'Exporta artefato carga-relatorio-*.json');
});
