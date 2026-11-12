// tests/unit/contrato-planner-path-validation.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// módulos da aplicação
const planner = require('../../nexia-ai/orchestrator/planner');
const produtos = require('../../nexia-ai/orchestrator/produtos');

// Helper para criar arquivos temporários
function createTempFile(dir, relativePath, content = '') {
  const fullPath = path.join(dir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
  return fullPath;
}

test('isPathValid – casos comuns, borda e inválido', async (t) => {
  // diretório raiz temporário que simula o repositório
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-'));

  // Produto de teste – será inserido dinamicamente em produtos
  const productName = 'TestProduct';
  // garante que não exista antes
  delete produtos[productName];
  // pasta‑mãe permitida para o produto
  const allowedAncestor = 'allowed/dir';
  produtos[productName] = [allowedAncestor];

  // 1️⃣ Caso comum: caminho existente
  const existentFile = createTempFile(repoRoot, 'valid/existent.js', '// dummy');
  const resExist = planner.isPathValid(productName, existentFile);
  assert.strictEqual(resExist, true, 'Caminho que realmente existe deve ser aceito');

  // 2️⃣ Caso de borda: arquivo inexistente, mas pasta‑mãe está na lista de permissões
  const pathWithAllowedAncestor = path.join(repoRoot, allowedAncestor, 'sub', 'arquivo.js');
  // Não criamos o arquivo nem a pasta‑mãe completa (apenas o caminho);
  // a validação deve considerar apenas o ancestral permitido.
  const resAncestor = planner.isPathValid(productName, pathWithAllowedAncestor);
  assert.strictEqual(resAncestor, true, 'Caminho inexistente deve ser aceito se a pasta‑mãe estiver listada em produtos');

  // 3️⃣ Caso inválido: caminho inexistente e sem ancestral permitido
  const invalidPath = path.join(repoRoot, 'invalid', 'missing.js');
  const resInvalid = planner.isPathValid(productName, invalidPath);
  assert.strictEqual(resInvalid, false, 'Caminho que não existe e cuja pasta‑mãe não está permitida deve ser rejeitado');
});
