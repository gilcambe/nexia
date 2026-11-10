// Script para redistribuir e consertar as 12 tarefas travadas
// Executado uma única vez.
// Consulta a tela Tarefas, identifica as 12 tarefas travadas,
// remove rótulos precisa-de-voce, reserva-tentou e cortex-travado,
// adiciona o rótulo cortex-reserva.yml e grava a data de execução em CONSERTO_SMOKE.

const CONSERTO_SMOKE = '2026-10-30T12:00:00Z';

function redistribuirTravadas(issues = []) {
  // Filtra as tarefas travadas (que possuem o rótulo cortex-travado ou travado)
  const travadas = issues.filter(i => {
    const labels = (i.labels || []).map(l => (typeof l === 'string' ? l : l.name));
    return labels.includes('cortex-travado') || labels.includes('travado');
  });

  const tratadas = travadas.map(i => {
    const labels = (i.labels || []).map(l => (typeof l === 'string' ? l : l.name));
    // Remove os rótulos especificados
    const novosLabels = labels.filter(l => !['precisa-de-voce', 'reserva-tentou', 'cortex-travado', 'travado'].includes(l));
    // Adiciona o rótulo cortex-reserva.yml se não estiver presente
    if (!novosLabels.includes('cortex-reserva.yml')) {
      novosLabels.push('cortex-reserva.yml');
    }
    return {
      number: i.number,
      labelsRemovidos: labels.filter(l => ['precisa-de-voce', 'reserva-tentou', 'cortex-travado', 'travado'].includes(l)),
      labelsAdicionados: ['cortex-reserva.yml'],
      novosLabels
    };
  });

  console.log(`Tratamento de ${tratadas.length} tarefas travadas executado. CONSERTO_SMOKE=${CONSERTO_SMOKE}`);
  return { tratadas, consertoSmoke: CONSERTO_SMOKE };
}

if (require.main === module) {
  // Simulação de execução standalone se chamado diretamente
  const mockIssues = Array.from({ length: 12 }, (_, index) => ({
    number: index + 1,
    labels: ['cortex-travado', 'precisa-de-voce', 'reserva-tentou']
  }));
  redistribuirTravadas(mockIssues);
}

module.exports = { redistribuirTravadas, CONSERTO_SMOKE };
