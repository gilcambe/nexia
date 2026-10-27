/**
 * escadaUtils - lógica pura que conta issues por degrau.
 *
 * Funções puras: não fazem I/O, não mutam entradas, dependem
 apenas dos argumentos recebidos. Retornam sempre o mesmo output
 para o mesmo input.
 */

/**
 * Conta quantas issues caem em cada degrau da semana.
 * @param {Array} issues - array de objetos { data: string, ... }
 * @returns {Object} contagem por dia da semana (seg..dom)
 */
function semana(issues = []) {
  const dias = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
  const contagem = {};
  dias.forEach((d) => { contagem[d] = 0; });

  issues.forEach((issue) => {
    const data = issue && issue.data ? new Date(issue.data) : null;
    if (!data || Number.isNaN(data.getTime())) {
      return;
    }
    const diaSemana = data.getDay(); // 0=dom .. 6=sab
    const chave = dias[(diaSemana + 6) % 7]; // 0=seg .. 6=dom
    contagem[chave] += 1;
  });

  return contagem;
}

/**
 * Percentual de issues que são do Cortex (têm label 'cortex').
 * @param {Array} issues - array de objetos { labels: string[], ... }
 * @returns {number} percentual de 0 a 100
 */
function percentCortex(issues = []) {
  if (!Array.isArray(issues) || issues.length === 0) {
    return 0;
  }
  const cortex = issues.filter((issue) => {
    const labels = issue && issue.labels ? issue.labels : [];
    return Array.isArray(labels) && labels.includes('cortex');
  }).length;
  return Math.round((cortex / issues.length) * 100);
}

/**
 * Conta quantas issues estão na fila (status 'open' ou 'fila').
 * @param {Array} issues - array de objetos { status: string, ... }
 * @returns {number} quantidade de issues na fila
 */
function fila(issues = []) {
  if (!Array.isArray(issues)) {
    return 0;
  }
  return issues.filter((issue) => {
    const status = issue && issue.status ? String(issue.status).toLowerCase() : '';
    return status === 'open' || status === 'fila';
  }).length;
}

/**
 * Conta quantas issues estão na fase B (label 'fase-b' ou 'faseB').
 * @param {Array} issues - array de objetos { labels: string[], ... }
 * @returns {number} quantidade de issues na fase B
 */
function faseB(issues = []) {
  if (!Array.isArray(issues)) {
    return 0;
  }
  return issues.filter((issue) => {
    const labels = issue && issue.labels ? issue.labels : [];
    if (!Array.isArray(labels)) {
      return false;
    }
    return labels.some((label) => {
      const l = String(label).toLowerCase();
      return l === 'fase-b' || l === 'faseb' || l === 'fase b';
    });
  }).length;
}

/**
 * Gera o JSON esperado com a contagem de issues por degrau.
 * @param {Array} issues - array de objetos de issues simulados
 * @returns {Object} { semana, percentCortex, fila, faseB }
 */
function contarPorDegrau(issues = []) {
  return {
    semana: semana(issues),
    percentCortex: percentCortex(issues),
    fila: fila(issues),
    faseB: faseB(issues),
  };
}

module.exports = {
  semana,
  percentCortex,
  fila,
  faseB,
  contarPorDegrau,
};
