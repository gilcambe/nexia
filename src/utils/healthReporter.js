/**
 * Utilitário para formatar resultados de health check (Parte 4/5 de #3377)
 */

function formatHealthReport(results) {
  if (!results || typeof results !== 'object') {
    return 'Nenhum dado de saúde disponível.';
  }

  const lines = ['Relatório de Saúde dos Providers:'];
  for (const [provider, info] of Object.entries(results)) {
    const statusIcon = info.status === 'ok' ? '✅' : '❌';
    lines.push(`- ${provider}: ${statusIcon} (${info.status}) [Latência: ${info.latencyMs || 0}ms]`);
  }

  return lines.join('\n');
}

function summarizeFailures(results) {
  if (!results) return 0;
  return Object.values(results).filter(r => r.status !== 'ok').length;
}

module.exports = {
  formatHealthReport,
  summarizeFailures
};
