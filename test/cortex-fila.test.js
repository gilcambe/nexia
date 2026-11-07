const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// Importa a função validatePart real de scripts/cortex-fila.js
// Se necessário, ajustamos o require dependendo de como está exportado.
let validatePart;
try {
  const cortexFila = require('../scripts/cortex-fila.js');
  validatePart = cortexFila.validatePart || (typeof cortexFila === 'function' ? cortexFila : null);
} catch (e) {
  // fallback se export for diferente
}

describe('validatePart - cortex-fila unit tests', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-fila-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (e) {}
  });

  test('Caso 1: part.arquivos contém caminho inexistente e part.tarefa inclui "criar arquivo" - validatePart aceita a parte', () => {
    const nonexistentPath = path.join(tmpDir, 'novo-arquivo.js');
    const part = {
      arquivos: [nonexistentPath],
      tarefa: 'criar arquivo de teste'
    };

    expect(validatePart).toBeDefined();
    const result = validatePart(part, 1);
    expect(result).toBe(true);
  });

  test('Caso 2: caminho não existe, a tarefa não menciona criação e attempt é 3 - validatePart devolve null', () => {
    const nonexistentPath = path.join(tmpDir, 'arquivo-inexistente.js');
    const part = {
      arquivos: [nonexistentPath],
      tarefa: 'atualizar sistema'
    };

    expect(validatePart).toBeDefined();
    const result = validatePart(part, 3);
    expect(result).toBeNull();
  });
});
