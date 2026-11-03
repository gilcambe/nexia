const { validatePart } = require('../scripts/cortex-fila');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('validatePart', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-fila-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {
      // Ignorar erros
    }
  });

  it('1) Caso onde part.arquivos contém caminho inexistente e part.tarefa inclui "criar arquivo" - validatePart aceita a parte', () => {
    const missingFile = path.join(tempDir, 'novo-arquivo.js');
    const part = {
      arquivos: [missingFile],
      tarefa: 'Criar arquivo para o módulo'
    };
    const attempt = 1;

    const result = validatePart(part, attempt);
    expect(result).not.toBeNull();
  });

  it('2) Caso onde o caminho não existe, a tarefa não menciona criação e attempt é 3 - validatePart devolve null (sinal de replanejamento)', () => {
    const missingFile = path.join(tempDir, 'inexistente.js');
    const part = {
      arquivos: [missingFile],
      tarefa: 'Atualizar rotas'
    };
    const attempt = 3;

    const result = validatePart(part, attempt);
    expect(result).toBeNull();
  });
});
