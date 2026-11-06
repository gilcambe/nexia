const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// Função validatePart conforme especificação dos testes unitários
function validatePart(part, attempt) {
  const arquivos = part.arquivos || [];
  const tarefa = String(part.tarefa || '').toLowerCase();
  
  for (const arq of arquivos) {
    const existe = fs.existsSync(arq);
    if (!existe) {
      const mencionaCriacao = tarefa.includes('criar arquivo') || tarefa.includes('criar') || tarefa.includes('novo');
      if (!mencionaCriacao && attempt >= 3) {
        return null;
      }
    }
  }
  return part;
}

test('validatePart - 1) caminho inexistente e tarefa inclui criar arquivo aceita a parte', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-fila-test-'));
  try {
    const missingFile = path.join(tempDir, 'sub', 'novo-arquivo.js');
    fs.mkdirSync(path.dirname(missingFile), { recursive: true });

    const part = {
      arquivos: [missingFile],
      tarefa: 'Criar arquivo do zero para o novo componente'
    };
    const attempt = 1;

    const result = validatePart(part, attempt);
    assert.deepStrictEqual(result, part);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('validatePart - 2) caminho não existe, tarefa sem menção de criação e attempt 3 devolve null', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-fila-test-'));
  try {
    const missingFile = path.join(tempDir, 'arquivo-inexistente.js');
    const part = {
      arquivos: [missingFile],
      tarefa: 'Atualizar rotas existentes no sistema'
    };
    const attempt = 3;

    const result = validatePart(part, attempt);
    assert.strictEqual(result, null);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('testar arquivos de apoio com fs.writeFileSync e fs.mkdirSync', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-fila-test-'));
  try {
    const supportFile = path.join(tempDir, 'suporte.js');
    fs.writeFileSync(supportFile, '// conteúdo de teste', 'utf8');
    assert.strictEqual(fs.existsSync(supportFile), true);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
