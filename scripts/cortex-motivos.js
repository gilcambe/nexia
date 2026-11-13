/**
 * Classificador de motivos para a Fila do Cortex (Fase 8).
 * Retorna um motivo padronizado em português simples com base nos rótulos e no último comentário.
 */
function classificarMotivo(issue) {
  if (!issue) return 'desconhecido';
  
  const rotulos = (issue.labels || []).map(l => typeof l === 'string' ? l : l.name);
  const comentario = (issue.ultimoComentario || issue.body || '').toLowerCase();

  if (rotulos.includes('so-humano')) return 'esperando-dono';
  if (rotulos.includes('vez-do-claude') || rotulos.includes('cortex-travado')) {
    if (comentario.includes('cota') || comentario.includes('limite')) return 'sem-cota';
    if (comentario.includes('grande') || comentario.includes('linhas')) return 'arquivo-grande';
    if (comentario.includes('ci') || comentario.includes('falhou') || comentario.includes('teste')) return 'ci-vermelho';
    return 'travado-n-tentativas';
  }
  if (rotulos.includes('cortex-fila') || rotulos.includes('cortex-rodando')) {
    if (comentario.includes('depende') || comentario.includes('aguardando')) return 'depende-de';
    if (comentario.includes('repetido') || comentario.includes('duplicado')) return 'pr-repetido';
    return 'workflow-so-dono';
  }

  return 'workflow-so-dono';
}

function listarMotivos() {
  return [
    'sem-cota',
    'arquivo-grande',
    'ci-vermelho',
    'esperando-dono',
    'travado-n-tentativas',
    'pr-repetido',
    'depende-de',
    'workflow-so-dono'
  ];
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { classificarMotivo, listarMotivos };
}
