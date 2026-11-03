const { validarCortexFeito } = require('../scripts/cortex-fila');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('validarCortexFeito', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-fila-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {
      // Ignorar erros de limpeza se houver
    }
  });

  it('deve aceitar a parte quando o caminho não existe mas a tarefa menciona criar arquivo', () => {
    const nonExistentFile = path.join(tempDir, 'novo-arquivo.js');
    const part = {
      arquivos: [nonExistentFile],
      tarefa: 'Criar arquivo novo para o sistema'
    };
    const attempt = 1;

    const result = validarCortexFeito(part, attempt);
    expect(result).not.toBeNull();
    expect(result).toBe(true);
  });

  it('deve devolver null (sinal de replanejamento) quando o caminho não existe, a tarefa não menciona criação e attempt é 3', () => {
    const nonExistentFile = path.join(tempDir, 'arquivo-inexistente.js');
    const part = {
      arquivos: [nonExistentFile],
      tarefa: 'Atualizar rotas existentes'
    };
    const attempt = 3;

    const result = validarCortexFeito(part, attempt);
    expect(result).toBeNull();
  });

  it('deve aceitar a parte quando o arquivo existe normalmente', () => {
    const existingFile = path.join(tempDir, 'existente.js');
    fs.writeFileSync(existingFile, 'console.log("ok");');
    const part = {
      arquivos: [existingFile],
      tarefa: 'Ajustar log'
    };
    const attempt = 1;

    const result = validarCortexFeito(part, attempt);
    expect(result).not.toBeNull();
    expect(result).toBe(true);
  });
});
