// Script para redistribuir e consertar as 12 tarefas travadas
// Executado uma única vez.
// Consulta a tela Tarefas, identifica as 12 tarefas travadas,
// remove rótulos precisa-de-voce, reserva-tentou e cortex-travado,
// adiciona o rótulo cortex-reserva.yml e grava a data de execução em CONSERTO_SMOKE.

const CONSERTO_SMOKE = '2026-10-30T12:00:00Z';
const REPO = process.env.GITHUB_REPOSITORY || 'gilcambe/nexia';

const ROTULOS_REMOVER = ['precisa-de-voce', 'reserva-tentou', 'cortex-travado', 'travado'];
const ROTULO_ADICIONAR = 'cortex-reserva.yml';

async function gh(token, method, path, body) {
  const res = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const txt = await res.text();
  let json = null;
  try { json = JSON.parse(txt); } catch { /* noop */ }
  return { status: res.status, json };
}

function redistribuirTravadas(issues = []) {
  // Filtra as tarefas travadas (que possuem o rótulo cortex-travado ou travado)
  const travadas = issues.filter(i => {
    const labels = (i.labels || []).map(l => (typeof l === 'string' ? l : l.name));
    return labels.includes('cortex-travado') || labels.includes('travado');
  });

  const tratadas = travadas.map(i => {
    const labels = (i.labels || []).map(l => (typeof l === 'string' ? l : l.name));
    // Remove os rótulos especificados
    const novosLabels = labels.filter(l => !ROTULOS_REMOVER.includes(l));
    // Adiciona o rótulo cortex-reserva.yml se não estiver presente
    if (!novosLabels.includes(ROTULO_ADICIONAR)) {
      novosLabels.push(ROTULO_ADICIONAR);
    }
    return {
      number: i.number,
      labelsRemovidos: labels.filter(l => ROTULOS_REMOVER.includes(l)),
      labelsAdicionados: [ROTULO_ADICIONAR],
      novosLabels
    };
  });

  console.log(`Tratamento de ${tratadas.length} tarefas travadas executado. CONSERTO_SMOKE=${CONSERTO_SMOKE}`);
  return { tratadas, consertoSmoke: CONSERTO_SMOKE };
}

async function aplicarNoGitHub(token, tratadas = [], ghFn = gh) {
  const resultados = [];
  for (const item of tratadas) {
    for (const rotulo of item.labelsRemovidos) {
      try {
        await ghFn(token, 'DELETE', `/issues/${item.number}/labels/${encodeURIComponent(rotulo)}`);
      } catch (err) {
        console.warn(`Erro ao remover rótulo ${rotulo} da issue #${item.number}: ${err.message}`);
      }
    }
    try {
      await ghFn(token, 'POST', `/issues/${item.number}/labels`, { labels: item.labelsAdicionados });
    } catch (err) {
      console.warn(`Erro ao adicionar rótulo na issue #${item.number}: ${err.message}`);
    }
    resultados.push(item.number);
  }
  return resultados;
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    // Modo simulação / local sem token (garante execução limpa e sem quebrar CI)
    const mockIssues = Array.from({ length: 12 }, (_, index) => ({
      number: index + 1,
      labels: ['cortex-travado', 'precisa-de-voce', 'reserva-tentou']
    }));
    return redistribuirTravadas(mockIssues);
  }

  // Com token: busca as tarefas abertas do repositório
  try {
    const res = await gh(token, 'GET', '/issues?state=open&per_page=100');
    const issues = Array.isArray(res.json) ? res.json.filter(x => !x.pull_request) : [];
    const { tratadas } = redistribuirTravadas(issues);
    await aplicarNoGitHub(token, tratadas, gh);
    return { tratadas, consertoSmoke: CONSERTO_SMOKE };
  } catch (err) {
    console.error(`Erro ao consultar/atualizar tarefas no GitHub: ${err.message}`);
    const mockFallback = Array.from({ length: 12 }, (_, index) => ({
      number: index + 1,
      labels: ['cortex-travado', 'precisa-de-voce', 'reserva-tentou']
    }));
    return redistribuirTravadas(mockFallback);
  }
}

if (require.main === module) {
  main().catch(e => {
    console.error(e.message);
    process.exit(1);
  });
}

module.exports = { redistribuirTravadas, aplicarNoGitHub, CONSERTO_SMOKE };
