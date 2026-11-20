'use strict';
// Cortex no celular (/meu-cortex): os pedidos do Cortex são as issues "cortex-fila" do GitHub.
// O histórico fica guardado lá para sempre, de graça, e não depende da Claude.

const REPO = 'gilcambe/nexia';
const API = 'https://api.github.com';

const { estadoTarefa, estadoTarefas } = require('./estado-tarefas');

const nomes = (i) => (i.labels || []).map((l) => l.name || l);
const tentativas = (i) => {
  const ls = nomes(i);
  return ls.reduce((m, l) => { const x = /^tentativa-(\\d+)$/.exec(l); return x ? Math.max(m, Number(x[1])) : m; }, 0);
};

function resumo(i) {
  const et = estadoTarefa(i);
  return {
    ...i,
    ...et,
    situacao: et.texto
  };
}

// Filtra e mapeia issues
async function lista(estadoFiltro = 'todas') {
  const response = await fetch(`${API}/repos/${REPO}/issues?labels=cortex-fila&state=all&per_page=100`, {
    headers: { 'Authorization': `token ${process.env.NEXIA_GITHUB_TOKEN}` }
  });
  if (!response.ok) return [];
  const issues = await response.json();
  
  const processadas = issues.map(resumo);
  const contagens = estadoTarefas(issues);
  
  if (estadoFiltro === 'todas') return processadas;
  
  return processadas.filter(i => {
    if (estadoFiltro === 'andamento') return i.estado === 'andamento';
    if (estadoFiltro === 'travadas') return i.estado === 'travada';
    if (estadoFiltro === 'concluidas') return i.estado === 'concluida';
    if (estadoFiltro === 'precisa') return i.precisaVoce;
    return true;
  });
}

module.exports = { resumo, lista };
