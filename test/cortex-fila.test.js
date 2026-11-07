const fs = require('fs');
const path = require('path');
const os = require('os');
const { validatePart } = require('../scripts/cortex-fila.js');

describe('validatePart - testes unitários com sistema de arquivos temporário', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-fila-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {
      // Ignorar erros na limpeza
    }
  });

  test('1) Caso onde part.arquivos contém caminho inexistente e part.tarefa inclui "criar arquivo" - validatePart aceita a parte', () => {
    const missingFile = path.join(tempDir, 'sub', 'novo-arquivo.js');
    
    // Usar fs.mkdirSync para criar diretórios de apoio
    fs.mkdirSync(path.dirname(missingFile), { recursive: true });

    const part = {
      arquivos: [missingFile],
      tarefa: 'Criar arquivo do zero para o novo componente'
    };
    const attempt = 1;

    const result = validatePart(part, attempt);
    expect(result).toEqual(part);
  });

  test('2) Caso onde o caminho não existe, a tarefa não menciona criação e attempt é 3 - validatePart devolve null (sinal de replanejamento)', () => {
    const missingFile = path.join(tempDir, 'arquivo-inexistente.js');
    const part = {
      arquivos: [missingFile],
      tarefa: 'Atualizar rotas existentes no sistema'
    };
    const attempt = 3;

    const result = validatePart(part, attempt);
    expect(result).toBeNull();
  });

  test('Teste auxiliar com fs.writeFileSync para arquivos existentes', () => {
    const supportFile = path.join(tempDir, 'suporte.js');
    fs.writeFileSync(supportFile, '// conteúdo de suporte', 'utf8');
    
    expect(fs.existsSync(supportFile)).toBe(true);
  });
});
