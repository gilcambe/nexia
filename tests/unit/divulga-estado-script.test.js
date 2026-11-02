'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { gerarResumoSeguidores, main } = require('../../.github/scripts/divulga-estado');

test('DIVULGA-ESTADO-SCRIPT: sem arquivo ou com arquivo vazio devolve "Sem dados de seguidores ainda"', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'divulga-test-'));
  const jsonInexistente = path.join(tmpDir, 'inexistente.json');
  assert.strictEqual(gerarResumoSeguidores(jsonInexistente), 'Sem dados de seguidores ainda');

  const jsonVazio = path.join(tmpDir, 'vazio.json');
  fs.writeFileSync(jsonVazio, JSON.stringify({ seguidores: [] }));
  assert.strictEqual(gerarResumoSeguidores(jsonVazio), 'Sem dados de seguidores ainda');
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('DIVULGA-ESTADO-SCRIPT: formata dados da chave "seguidores" ({ dia, total }) e calcula saldo', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'divulga-test-'));
  const jsonPath = path.join(tmpDir, 'divulga-estado.json');

  const dados = {
    seguidores: [
      { dia: '2026-04-01', total: 100 },
      { dia: '2026-04-02', total: 105 },
      { dia: '2026-04-03', total: 120 },
    ],
  };
  fs.writeFileSync(jsonPath, JSON.stringify(dados));

  const res = gerarResumoSeguidores(jsonPath);
  assert.ok(res.includes('| Dia | Seguidores |'));
  assert.ok(res.includes('| 01/04/2026 | 100 |'));
  assert.ok(res.includes('| 02/04/2026 | 105 |'));
  assert.ok(res.includes('| 03/04/2026 | 120 |'));
  assert.ok(res.includes('+20 seguidores em 3 dias'));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('DIVULGA-ESTADO-SCRIPT: formata dados legados da chave "estado" ({ dia, seguidores }) e sinal negativo no saldo', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'divulga-test-'));
  const jsonPath = path.join(tmpDir, 'divulga-estado.json');

  const dados = {
    estado: [
      { dia: '2026-04-01', seguidores: 200 },
      { dia: '2026-04-02', seguidores: 190 },
    ],
  };
  fs.writeFileSync(jsonPath, JSON.stringify(dados));

  const res = gerarResumoSeguidores(jsonPath);
  assert.ok(res.includes('| 01/04/2026 | 200 |'));
  assert.ok(res.includes('| 02/04/2026 | 190 |'));
  assert.ok(res.includes('-10 seguidores em 2 dias'));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('DIVULGA-ESTADO-SCRIPT: limita exibições aos últimos 14 dias', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'divulga-test-'));
  const jsonPath = path.join(tmpDir, 'divulga-estado.json');

  const seguidores = [];
  for (let i = 1; i <= 20; i++) {
    const dia = i < 10 ? `2026-04-0${i}` : `2026-04-${i}`;
    seguidores.push({ dia, total: 100 + i });
  }
  fs.writeFileSync(jsonPath, JSON.stringify({ seguidores }));

  const res = gerarResumoSeguidores(jsonPath);
  assert.ok(!res.includes('| 01/04/2026 | 101 |')); // 1º item foi cortado (ultimos 14)
  assert.ok(!res.includes('| 06/04/2026 | 106 |')); // 6º item foi cortado
  assert.ok(res.includes('| 07/04/2026 | 107 |'));  // 7º item está presente
  assert.ok(res.includes('| 20/04/2026 | 120 |'));
  assert.ok(res.includes('+13 seguidores em 14 dias'));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('DIVULGA-ESTADO-SCRIPT: main() escreve no GITHUB_STEP_SUMMARY quando definido', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'divulga-test-'));
  const summaryFile = path.join(tmpDir, 'summary.md');
  const originalEnv = process.env.GITHUB_STEP_SUMMARY;

  try {
    process.env.GITHUB_STEP_SUMMARY = summaryFile;
    main();
    assert.ok(fs.existsSync(summaryFile));
    const content = fs.readFileSync(summaryFile, 'utf8');
    assert.strictEqual(content, 'Sem dados de seguidores ainda');
  } finally {
    if (originalEnv !== undefined) {
      process.env.GITHUB_STEP_SUMMARY = originalEnv;
    } else {
      delete process.env.GITHUB_STEP_SUMMARY;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
