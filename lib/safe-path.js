'use strict';
// Parte pura (sem fs) da resolução segura de estáticos, usada também pelo Worker (ADR-FREE-01).

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

module.exports = { normalizeRequestPath, DEFAULT_EXTENSIONS };
