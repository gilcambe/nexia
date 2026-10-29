'use strict';
// Utilidades de revisão de PR. Usadas pelos scripts de review antes de aceitar uma mudança.

// Retorna true se o PR altera arquivos restritos:
// - firestore.rules (exatamente)
// - qualquer arquivo em .github/workflows/
// - qualquer arquivo em secrets/ (qualquer subpasta)
// pr.files: array de { filename, additions?, deletions? }
function isRestrictedChange(pr) {
  const arquivos = Array.isArray(pr && pr.files) ? pr.files : [];
  return arquivos.some(f => {
    const nome = String(f && f.filename || '');
    if (nome === 'firestore.rules') return true;
    if (nome.startsWith('.github/workflows/')) return true;
    if (nome.startsWith('secrets/')) return true;
    return false;
  });
}

// Retorna true se o PR está vazio:
// - pr.files não existe ou está vazio (0 arquivos), ou
// - soma de additions + deletions de todos os arquivos é 0 (0 linhas alteradas)
function isEmptyPR(pr) {
  const arquivos = Array.isArray(pr && pr.files) ? pr.files : [];
  if (arquivos.length === 0) return true;
  let linhas = 0;
  for (const f of arquivos) {
    linhas += Number(f && f.additions || 0) + Number(f && f.deletions || 0);
  }
  return linhas === 0;
}

module.exports = { isRestrictedChange, isEmptyPR };
