const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const TAREFAS_DIR = path.resolve(__dirname, '../../nexia-ai/contrato/regua/tarefas');

// IDs das tarefas conforme a estrutura do diretório, filtrando apenas pastas válidas
const getTarefas = () => {
  return fs.readdirSync(TAREFAS_DIR)
    .filter(name => fs.statSync(path.join(TAREFAS_DIR, name)).isDirectory())
    .sort();
};

test('validar estrutura das tarefas da régua', () => {
  const tarefas = getTarefas();
  // Esperado 10 tarefas conforme listagem, mas o pedido menciona 8 (3 originais + 5 novas).
  // Ajustando para validar todas que existem na pasta.
  assert.ok(tarefas.length >= 8, `Esperado pelo menos 8 tarefas, encontrado ${tarefas.length}`);

  for (const id of tarefas) {
    const dir = path.join(TAREFAS_DIR, id);
    assert.ok(fs.existsSync(path.join(dir, 'pedido.md')), `Tarefa ${id} faltando pedido.md`);
    assert.ok(fs.existsSync(path.join(dir, 'visivel.test.js')), `Tarefa ${id} faltando visivel.test.js`);
    assert.ok(fs.existsSync(path.join(dir, 'oculto.test.js')), `Tarefa ${id} faltando oculto.test.js`);
  }
});

test('validar falha de implementação inicial para tarefas novas', () => {
  const tarefas = getTarefas();
  
  for (const id of tarefas) {
    const dir = path.join(TAREFAS_DIR, id);
    const tmp = fs.mkdtempSync(path.join(require('node:os').tmpdir(), `test-${id}-`));
    
    try {
      // Simula ausência de implementação copiando apenas o básico
      const files = ['visivel.test.js', 'oculto.test.js'];
      files.forEach(f => {
        if (fs.existsSync(path.join(dir, f))) {
          fs.copyFileSync(path.join(dir, f), path.join(tmp, f));
        }
      });

      // Roda testes contra um ambiente sem arquivos de solução
      const runTest = (testFile) => {
        try {
          execSync(`node --test ${path.join(tmp, testFile)}`, { stdio: 'pipe' });
          return true; // passou
        } catch {
          return false; // falhou (esperado)
        }
      };

      const visivelPassou = runTest('visivel.test.js');
      const ocultoPassou = runTest('oculto.test.js');

      assert.strictEqual(visivelPassou, false, `Tarefa ${id} deveria falhar no teste visível sem solução`);
      assert.strictEqual(ocultoPassou, false, `Tarefa ${id} deveria falhar no teste oculto sem solução`);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }
});

test('validar sucesso de implementação com solucao.js', () => {
  const tarefas = getTarefas();

  for (const id of tarefas) {
    const dir = path.join(TAREFAS_DIR, id);
    if (!fs.existsSync(path.join(dir, 'solucao.js'))) continue;

    const tmp = fs.mkdtempSync(path.join(require('node:os').tmpdir(), `test-sol-${id}-`));
    
    try {
      // Copia tudo (incluindo solução)
      const copyRecursive = (src, dest) => {
        fs.mkdirSync(dest, { recursive: true });
        fs.readdirSync(src).forEach(n => {
          const s = path.join(src, n);
          const d = path.join(dest, n);
          if (fs.statSync(s).isDirectory()) copyRecursive(s, d);
          else fs.copyFileSync(s, d);
        });
      };
      copyRecursive(dir, tmp);

      // Roda testes
      const runTest = (testFile) => {
        try {
          execSync(`node --test ${path.join(tmp, testFile)}`, { stdio: 'pipe' });
          return true;
        } catch {
          return false;
        }
      };

      assert.strictEqual(runTest('visivel.test.js'), true, `Tarefa ${id} deveria passar no teste visível com solução`);
      assert.strictEqual(runTest('oculto.test.js'), true, `Tarefa ${id} deveria passar no teste oculto com solução`);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }
});
