// nexia-ai/orchestrator/planner.js
const fs = require('node:fs');
const path = require('node:path');

// produtos será um objeto que pode ser modificado dinamicamente pelos testes
const produtos = require('./produtos');

/**
 * Verifica se o caminho fornecido é válido para o produto especificado.
 *
 * @param {string} productName - Nome do produto (chave em `produtos`).
 * @param {string} targetPath  - Caminho absoluto ou relativo do arquivo a validar.
 * @returns {boolean} true se o caminho existir ou se alguma pasta‑mãe estiver listada nas permissões do produto.
 */
function isPathValid(productName, targetPath) {
  // Resolve o caminho para um caminho absoluto
  const resolvedPath = path.isAbsolute(targetPath)
    ? path.normalize(targetPath)
    : path.resolve(targetPath);

  // 1️⃣ Se o arquivo (ou diretório) existir, aceitamos imediatamente
  if (fs.existsSync(resolvedPath)) {
    return true;
  }

  // 2️⃣ Caso não exista, verificamos se algum ancestral está permitido para o produto
  const allowedAncestors = produtos[productName] ?? [];

  // Diretório onde o arquivo seria criado
  let dir = path.dirname(resolvedPath);

  // Helper para comparar se `dir` termina com a sequência de pastas de `allowed`
  const matchesAllowedAncestor = (dirPath, allowed) => {
    const dirParts = dirPath.split(path.sep).filter(Boolean);
    const allowedParts = allowed.split(/[\\/]/).filter(Boolean);

    if (allowedParts.length > dirParts.length) return false;

    for (let i = 1; i <= allowedParts.length; i++) {
      if (dirParts[dirParts.length - i] !== allowedParts[allowedParts.length - i]) {
        return false;
      }
    }
    return true;
  };

  // Percorre a cadeia de diretórios ascendentes procurando um match
  while (true) {
    for (const anc of allowedAncestors) {
      if (matchesAllowedAncestor(dir, anc)) {
        return true;
      }
    }

    const parent = path.dirname(dir);
    if (parent === dir) break; // chegou à raiz
    dir = parent;
  }

  // Nenhum critério satisfeito
  return false;
}

// Exporta a função (e, se necessário no futuro, outras funcionalidades)
module.exports = {
  isPathValid,
};
