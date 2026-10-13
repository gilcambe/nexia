'use strict';

/**
 * Middleware / utilitário de pré-checagem e validação de consistência para PRs do Cortex.
 */

function validateCortexConsistency(issueBody, changedFiles) {
  if (!issueBody) return true;
  const matches = issueBody.match(/`([^`]+)`/g);
  if (!matches || matches.length === 0) return true;
  const requestedFiles = matches
    .map(m => m.replace(/`/g, '').trim())
    .filter(f => f.includes('/') || f.includes('.'));
  if (requestedFiles.length === 0) return true;
  // Se nenhum dos arquivos solicitados foi alterado, retorna falso (rejeita a consistência)
  return requestedFiles.every(f => changedFiles.includes(f)) || requestedFiles.some(f => changedFiles.includes(f));
}

module.exports = {
  validateCortexConsistency,
};
