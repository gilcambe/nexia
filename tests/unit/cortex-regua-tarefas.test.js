const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const TAREFAS_DIR = path.resolve(__dirname, '../../nexia-ai/contrato/regua/tarefas');

const getTarefas = () => {
  return fs.readdirSync(TAREFAS_DIR)
    .filter(name => fs.statSync(path.join(TAREFAS_DIR, name)).isDirectory())
    .sort();
};

test('validar estrutura das 8 tarefas', () => {
  const tarefas = getTarefas();
  assert.strictEqual(tarefas.length, 8, `Esperado exatamente 8 tarefas, encontrado ${tarefas.length}`);

  for (const id of tarefas) {
    const dir = path.join(TAREFAS_DIR, id);
    assert.ok(fs.existsSync(path.join(dir, 'pedido.md')), `Tarefa ${id} faltando pedido.md`);
    assert.ok(fs.existsSync(path.join(dir, 'visivel.test.js')), `Tarefa ${id} faltando visivel.test.js`);
    assert.ok(fs.existsSync(path.join(dir, 'oculto.test.js')), `Tarefa ${id} faltando oculto.test.js`);
  }
});

test('validar falha de implementação para tarefas novas', () => {
  const tarefas = getTarefas();
  // Assume que as tarefas novas são as últimas 5 da lista ordenada
  const tarefasNovas = tarefas.slice(-5);
  
  for (const id of tarefasNovas) {
    const dir = path.join(TAREFAS_DIR, id);
    const tmp = fs.mkdtempSync(path.join(require('node:os').tmpdir(), `test-fail-${id}-`));
    
    try {
      // Simula ausência de implementação criando apenas um arquivo vazio
      fs.writeFileSync(path.join(tmp, 'index.js'), 'module.exports = {};');

      // Roda testes contra o ambiente vazio
      const runTest = (testFile) => {
        try {
          // Copia o teste para o tmp
          fs.copyFileSync(path.join(dir, testFile), path.join(tmp, testFile));
          execSync(`node --test ${path.join(tmp, testFile)}`, { stdio: 'ignore' });
          return true;
        } catch {
          return false;
        }
      };

      assert.strictEqual(runTest('visivel.test.js'), false, `Tarefa ${id} deveria falhar no teste visível sem solução`);
      assert.strictEqual(runTest('oculto.test.js'), false, `Tarefa ${id} deveria falhar no teste oculto sem solução`);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }
});

test('validar sucesso de implementação com solucao.js para tarefas novas', () => {
  const tarefas = getTarefas();
  const tarefasNovas = tarefas.slice(-5);

  for (const id of tarefasNovas) {
    const dir = path.join(TAREFAS_DIR, id);
    assert.ok(fs.existsSync(path.join(dir, 'solucao.js')), `Tarefa nova ${id} faltando solucao.js`);

    const tmp = fs.mkdtempSync(path.join(require('node:os').tmpdir(), `test-sol-${id}-`));
    
    try {
      // Copia tudo (incluindo solução)
      fs.copyFileSync(path.join(dir, 'solucao.js'), path.join(tmp, 'index.js'));

      const runTest = (testFile) => {
        try {
          fs.copyFileSync(path.join(dir, testFile), path.join(tmp, testFile));
          execSync(`node --test ${path.join(tmp, testFile)}`, { stdio: 'ignore' });
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
