'use strict';

/**
 * Utilitário para formatar resultados de health check dos providers.
 */
function formatHealthReport(results) {
  if (!results || typeof results !== 'object') {
    return 'Nenhum resultado de health check disponível.';
  }

  const entries = Object.entries(results);
  if (entries.length === 0) {
    return 'Relatório de saúde vazio.';
  }

  let report = '=== RELATÓRIO DE SAÚDE DOS PROVIDERS ===';
  for (const [provider, data] of entries) {
    const status = data.success ? '🟢 OK' : '🔴 FALHA';
    const time = data.timestamp ? new Date(data.timestamp).toISOString() : 'N/A';
    const errorMsg = data.error ? ` - Erro: ${data.error}` : '';
    report += `- [${provider}] Status: ${status} | Última verificação: ${time}${errorMsg}\n`;
  }
  return report.trim();
}

module.exports = {
  formatHealthReport
};
