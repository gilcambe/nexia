'use strict';
/**
 * safe-static — resolução segura de arquivos estáticos (SEC Fase 1, C1).
 *
 * Só serve arquivos que, depois de decodificados, normalizados e com symlinks
 * resolvidos, continuam dentro de uma raiz pública explicitamente permitida.
 * Segmentos ocultos (.env, .git, ...) e extensões fora da allowlist são negados.
 */
const fs   = require('fs');
const path = require('path');

const DEFAULT_EXTENSIONS = new Set([
  '.html', '.css', '.js', '.json', '.svg', '.png', '.jpg', '.jpeg', '.webp',
  '.ico', '.gif', '.woff', '.woff2', '.ttf', '.txt', '.xml', '.webmanifest', '.map',
]);

/**
 * Decodifica o pathname da URL uma única vez. Retorna null se o caminho for
 * inválido ou suspeito (encoding malformado, byte nulo, barra invertida,
 * barra codificada, segmentos "." / ".." ou ocultos).
 */
function normalizeRequestPath(rawPathname) {
  if (typeof rawPathname !== 'string' || !rawPathname.startsWith('/')) return null;
  // Barras codificadas (%2f, %5c) nunca são legítimas para arquivos estáticos
  if (/%2f|%5c/i.test(rawPathname)) return null;
  let decoded;
  try { decoded = decodeURIComponent(rawPathname); } catch { return null; }
  if (decoded.includes('\0') || decoded.includes('\\')) return null;
  // Double encoding: depois de uma decodificação não pode sobrar sequência %XX
  if (/%[0-9a-f]{2}/i.test(decoded)) return null;
  const segments = decoded.split('/').filter(Boolean);
  for (const seg of segments) {
    if (seg === '.' || seg === '..' || seg.startsWith('.')) return null;
  }
  return '/' + segments.join('/');
}

function isInside(root, target) {
  const rel = path.relative(root, target);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * resolveStatic(root, relPath, opts) → caminho absoluto real do arquivo, ou null.
 * relPath é o caminho já normalizado (saída de normalizeRequestPath), relativo à raiz.
 */
function resolveStatic(root, relPath, opts = {}) {
  const extensions = opts.extensions || DEFAULT_EXTENSIONS;
  if (typeof relPath !== 'string') return null;
  const clean = relPath.replace(/^\/+/, '');
  if (!clean) return null;
  let realRoot;
  try { realRoot = fs.realpathSync(root); } catch { return null; }
  const candidate = path.resolve(realRoot, clean);
  if (!isInside(realRoot, candidate)) return null;
  const ext = path.extname(candidate).toLowerCase();
  if (!extensions.has(ext)) return null;
  let real;
  try { real = fs.realpathSync(candidate); } catch { return null; }
  // Symlink apontando para fora da raiz é negado
  if (!isInside(realRoot, real)) return null;
  try { if (!fs.statSync(real).isFile()) return null; } catch { return null; }
  return real;
}

module.exports = { normalizeRequestPath, resolveStatic, isInside, DEFAULT_EXTENSIONS };
