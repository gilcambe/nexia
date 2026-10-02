'use strict';
// Proteção de workspace (spec §8): todo caminho é resolvido dentro de uma raiz
// autorizada do projeto. Bloqueia path traversal, caminho absoluto fora das raízes,
// drive/UNC no Windows, byte nulo e symlink que aponta para fora.
const fs = require('fs');
const nodePath = require('path');
const { BridgeError } = require('./errors');

/** `child` está dentro de `root` (ou é a própria raiz)? Comparação sem caixa no Windows. */
function isInside(root, child, p = nodePath) {
  const norm = s => (p === nodePath.win32 ? s.toLowerCase() : s);
  const rel = p.relative(norm(root), norm(child));
  return rel === '' || (!rel.startsWith('..') && !p.isAbsolute(rel));
}

/** realpath do caminho, ou do ancestral existente mais próximo + o resto (para arquivos novos). */
function realpathLoose(abs) {
  let cur = abs;
  const rest = [];
  while (true) {
    try {
      const real = fs.realpathSync.native(cur);
      return rest.length ? nodePath.join(real, ...rest.reverse()) : real;
    } catch (e) {
      if (e.code !== 'ENOENT' && e.code !== 'ENOTDIR') throw e;
      const parent = nodePath.dirname(cur);
      if (parent === cur) return abs;
      rest.push(nodePath.basename(cur));
      cur = parent;
    }
  }
}

/**
 * Resolve `input` (relativo à primeira raiz, ou absoluto dentro de alguma raiz).
 * @returns {{ abs: string, root: string, rel: string }}
 */
function resolveInRoots(roots, input = '.') {
  if (typeof input !== 'string' || input.length > 4096) throw new BridgeError('INVALID_PATH', 'Caminho inválido.');
  if (input.includes('\0')) throw new BridgeError('INVALID_PATH', 'Caminho com byte nulo.');
  if (/^\\\\|^\/\/[^/]/.test(input)) throw new BridgeError('OUTSIDE_WORKSPACE', 'Caminho de rede (UNC) não é permitido.');
  if (/^[A-Za-z]:(?![\\/])/.test(input)) throw new BridgeError('INVALID_PATH', 'Caminho relativo a drive (ex.: C:pasta) não é permitido.');
  const realRoots = roots.map(r => fs.realpathSync.native(r));
  const abs = nodePath.isAbsolute(input) || /^[A-Za-z]:[\\/]/.test(input)
    ? nodePath.resolve(input)
    : nodePath.resolve(realRoots[0], input);
  const lexicalRoot = realRoots.find(r => isInside(r, abs)) || roots.map(r => nodePath.resolve(r)).find(r => isInside(r, abs));
  if (!lexicalRoot) throw new BridgeError('OUTSIDE_WORKSPACE', 'Caminho fora das raízes autorizadas do projeto.');
  const real = realpathLoose(abs);
  const root = realRoots.find(r => isInside(r, real));
  if (!root) throw new BridgeError('SYMLINK_ESCAPE', 'O caminho passa por um link simbólico que sai do workspace.');
  return { abs: real, root, rel: nodePath.relative(root, real) || '.' };
}

module.exports = { resolveInRoots, isInside, realpathLoose };
