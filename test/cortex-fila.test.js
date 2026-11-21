const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// Simulando o ambiente da função validatePart
// Importando validatePart de scripts/cortex-fila.js para testar a lógica real.
// Assumimos que validatePart é exportada ou acessível conforme necessário.
const { validatePart } = require('../scripts/cortex-fila');


describe('validatePart', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('deve aceitar parte se caminho inexistente e tarefa for criar arquivo', () => {
    const caminho = path.join(tempDir, 'novo.txt');
    const part = { arquivos: [caminho], tarefa: 'criar arquivo novo' };
    expect(validatePart(part, 1)).toBe(true);
  });

  test('deve retornar null se caminho não existe, tarefa não cria arquivo e tentativa for 3', () => {
    const caminho = path.join(tempDir, 'inexistente.txt');
    const part = { arquivos: [caminho], tarefa: 'ler arquivo' };
    expect(validatePart(part, 3)).toBeNull();
  });
});
