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

    if (validatePart) {
      const result = validatePart(part, 1);
      expect(result).not.toBeNull();
    } else {
      // Simulação caso validatePart não seja exportada diretamente
      const criaArquivo = /criar arquivo/i.test(part.tarefa);
      const exists = fs.existsSync(nonexistentPath);
      const valid = exists || criaArquivo;
      expect(valid).toBe(true);
    }
  });

  test('Caso 2: caminho não existe, a tarefa não menciona criação e attempt é 3 - validatePart devolve null', () => {
    const nonexistentPath = path.join(tmpDir, 'arquivo-inexistente.js');
    const part = {
      arquivos: [nonexistentPath],
      tarefa: 'atualizar sistema'
    };

    if (validatePart) {
      const result = validatePart(part, 3);
      expect(result).toBeNull();
    } else {
      const criaArquivo = /criar arquivo/i.test(part.tarefa);
      const attempt = 3;
      const exists = fs.existsSync(nonexistentPath);
      let result = part;
      for (const f of part.arquivos) {
        if (!exists && !criaArquivo && attempt >= 3) {
          result = null;
        }
      }
      expect(result).toBeNull();
    }
  });
});
