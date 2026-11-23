const fs = require('fs');
const path = require('path');

const DEFAULT_EXTENSIONS = ['.js', '.cjs', '.mjs', '.ts', '.tsx', '.py', '.html', '.md', '.json', '.yml'];
const DEFAULT_IGNORE = ['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.wrangler'];
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024; // 2 MB

function shouldIgnore(name, relativePath, ignoreList) {
  if (ignoreList.includes(name)) return true;
  if (name.startsWith('playwright-report')) return true;
  // Check if any segment matches ignore rules
  const segments = relativePath.split('/');
  for (const seg of segments) {
    if (ignoreList.includes(seg) || seg.startsWith('playwright-report')) {
      return true;
    }
  }
  return false;
}

function lerTexto(raiz, caminhoRelativo) {
  try {
    const fullPath = path.join(raiz, caminhoRelativo);
    return fs.readFileSync(fullPath, 'utf8');
  } catch (err) {
    return '';
  }
}

function varrerProjeto(raiz, opcoes = {}) {
  const extensoes = opcoes.extensoes || DEFAULT_EXTENSIONS;
  const ignorar = opcoes.ignorar || DEFAULT_IGNORE;
  const maxBytes = opcoes.maxBytes !== undefined ? opcoes.maxBytes : DEFAULT_MAX_BYTES;

  const arquivos = [];
  const porExtensao = {};
  const porPasta = {};
  let total = 0;

  function walk(currentDir, currentRel = '') {
    let entries;
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch (err) {
      return;
    }

    for (const entry of entries) {
      const name = entry.name;
      const relPath = currentRel ? `${currentRel}/${name}` : name;

      if (shouldIgnore(name, relPath, ignorar)) {
        continue;
      }

      const fullPath = path.join(currentDir, name);

      if (entry.isDirectory()) {
        walk(fullPath, relPath);
      } else if (entry.isFile()) {
        const ext = path.extname(name).toLowerCase();
        if (!extensoes.includes(ext)) {
          continue;
        }

        let stats;
        try {
          stats = fs.statSync(fullPath);
        } catch (err) {
          continue;
        }

        const bytes = stats.size;
        let linhas = null;

        if (bytes <= maxBytes) {
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            // Count lines (number of newlines + 1, or 0 if empty)
            if (content.length === 0) {
              linhas = 0;
            } else {
              let lineCount = 1;
              for (let i = 0; i < content.length; i++) {
                if (content[i] === '\n') {
                  lineCount++;
                }
              }
              linhas = lineCount;
            }
          } catch (err) {
            linhas = null;
          }
        }

        // Normalize relative path with normal slashes
        const normalizedRel = relPath.replace(/\\/g, '/');

        arquivos.push({
          caminho: normalizedRel,
          linhas,
          bytes,
          ext
        });

        // porExtensao count
        porExtensao[ext] = (porExtensao[ext] || 0) + 1;

        // porPasta count (first level of normalizedRel)
        const firstSegment = normalizedRel.includes('/') ? normalizedRel.split('/')[0] : '.';
        porPasta[firstSegment] = (porPasta[firstSegment] || 0) + 1;

        total++;
      }
    }
  }

  walk(raiz);

  return {
    arquivos,
    porExtensao,
    porPasta,
    total
  };
}

module.exports = {
  varrerProjeto,
  lerTexto
};
