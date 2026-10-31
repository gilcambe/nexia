const { Octokit } = require('@octokit/rest');

const LIMITE_FECHAMENTOS = 15;
const EXCECOES_ROTULOS = ['nao-fechar', 'manter'];

function decidir(prs, agora) {
  const grupos = new Map();

  // Agrupar PRs por número da issue
  for (const pr of prs) {
    const issueNumber = pr.title.match(/#(\d+)/)?.[1];
    if (!issueNumber) continue;

    if (!grupos.has(issueNumber)) {
      grupos.set(issueNumber, []);
    }
    grupos.get(issueNumber).push(pr);
  }

  const fechar = [];

  // Selecionar PRs a fechar
  for (const [issueNumber, grupo] of grupos) {
    if (grupo.length <= 1) continue;

    // Ordenar por CI verde mais novo ou mais novo
    grupo.sort((a, b) => {
      if (a.ciStatus === 'success' && b.ciStatus !== 'success') return -1;
      if (a.ciStatus !== 'success' && b.ciStatus === 'success') return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    // Selecionar PR a manter
    const manter = grupo[0];

    // Adicionar PRs a fechar
    for (let i = 1; i < grupo.length; i++) {
      const pr = grupo[i];

      // Verificar exceções de rótulos
      if (pr.labels.some(label => EXCECOES_ROTULOS.includes(label.name))) continue;

      // Verificar CI vermelho >48h
      if (pr.ciStatus === 'failure' && (agora - new Date(pr.createdAt)) / (1000 * 60 * 60) > 48) {
        fechar.push(pr);
      } else {
        fechar.push(pr);
      }
    }
  }

  // Limitar a 15 fechamentos por rodada
  return fechar.slice(0, LIMITE_FECHAMENTOS);
}

async function rodar() {
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

  // Buscar PRs abertos
  const { data: prs } = await octokit.pulls.list({
    owner: 'seu-usuario',
    repo: 'seu-repositorio',
    state: 'open',
    base: 'nexia/',
  });

  // Preparar PRs para a função decidir
  const prsParaDecidir = prs.map(pr => ({
    number: pr.number,
    title: pr.title,
    createdAt: pr.created_at,
    ciStatus: pr.mergeable_state,
    labels: pr.labels,
  }));

  // Chamar função decidir
  const fechar = decidir(prsParaDecidir, new Date());

  // Executar fechamentos
  for (const pr of fechar) {
    await octokit.pulls.update({
      owner: 'seu-usuario',
      repo: 'seu-repositorio',
      pull_number: pr.number,
      state: 'closed',
    });

    await octokit.issues.createComment({
      owner: 'seu-usuario',
      repo: 'seu-repositorio',
      issue_number: pr.number,
      body: 'Este PR foi fechado automaticamente porque há outro PR mais recente para a mesma issue.',
    });
  }

  return fechar.length;
}

module.exports = { decidir, rodar };
