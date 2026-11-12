const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// função a ser testada
const { validatePart } = require('../../scripts/cortex-fila');

let tmpDir;

beforeEach(() => {
  // cria diretório temporário isolado para cada teste
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-fila-test-'));
});

afterEach(() => {
  // remove recursivamente o diretório temporário
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('validatePart - comportamento geral', () => {
  test('caminhos válidos são mantidos (caso comum)', () => {
    const fileA = path.join(tmpDir, 'a.txt');
    const fileB = path.join(tmpDir, 'b.md');
    fs.writeFileSync(fileA, 'a');
    fs.writeFileSync(fileB, 'b');

    const part = {
      tarefa: 'Processar arquivos',
      arquivos: [fileA, fileB]
    };

    const result = validatePart(part, 1);
    assert.ok(result, 'result não deve ser null');
    assert.deepStrictEqual(result.arquivos, [fileA, fileB], 'os caminhos devem permanecer inalterados');
  });

  test('caminho inexistente permitido quando tarefa contém "criar arquivo" (borda)', () => {
    const existent = path.join(tmpDir, 'exist.txt');
    fs.writeFileSync(existent, 'ok');
    const missing = path.join(tmpDir, 'missing.txt'); // não será criado

    const part = {
      tarefa: 'Criar arquivo de relatório', // contém a frase "criar arquivo" (case‑insensitive)
      arquivos: [existent, missing]
    };

    const result = validatePart(part, 1);
    assert.ok(result, 'result deve ser um objeto, não null');
    // o caminho inexistente deve ser mantido, pois a tarefa permite criação
    assert.deepStrictEqual(result.arquivos, [existent, missing]);
  });

  test('caminho inexistente sem permissão tenta substituir por arquivo da mesma extensão', () => {
    const existent = path.join(tmpDir, 'good.txt');
    const substitute = path.join(tmpDir, 'sub.txt');
    fs.writeFileSync(existent, 'x');
    fs.writeFileSync(substitute, 'y'); // será usado como substituto
    const missing = path.join(tmpDir, 'missing.txt'); // não existe

    const part = {
      tarefa: 'Processar',
      arquivos: [existent, missing]
    };

    const result = validatePart(part, 1);
    assert.ok(result, 'deve retornar objeto ajustado');
    // o caminho inexistente deve ser trocado pelo primeiro arquivo .txt encontrado (sub.txt)
    assert.deepStrictEqual(result.arquivos, [existent, substitute]);
  });

  test('caminho inexistente sem substituto resulta em replanejamento (null)', () => {
    const existent = path.join(tmpDir, 'good.md');
    fs.writeFileSync(existent, 'z');
    const missing = path.join(tmpDir, 'missing.txt'); // extensão .txt não tem nenhum .txt no diretório

    const part = {
      tarefa: 'Processar',
      arquivos: [existent, missing]
    };

    const result = validatePart(part, 1);
    assert.strictEqual(result, null, 'deve retornar null indicando replanejamento');
  });

  test('quando attempt >= 3 e ainda há caminho inexistente, devolve null imediatamente', () => {
    const existent = path.join(tmpDir, 'ok.txt');
    fs.writeFileSync(existent, 'ok');
    const missing = path.join(tmpDir, 'still-missing.txt'); // não existe

    const part = {
      tarefa: 'Criar arquivo de log', // contém a frase que permitiria criação, mas attempt já é alto
      arquivos: [existent, missing]
    };

    const result = validatePart(part, 3);
    assert.strictEqual(result, null, 'com attempt >= 3 deve retornar null mesmo que a tarefa permita criação');
  });
});