const LIMITE_FECHAMENTOS = 15;
const EXCECOES_ROTULOS = ['nao-fechar', 'manter'];

// API simulada para testes
const githubApi = {
  async pullsList(owner, repo, state) {
    // Retorna dados simulados para testes
    return {
      data: [
        {
          number: 1,
          title: 'Teste PR #123',
          head: { ref: 'nexia/feature-123' },
          created_at: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
          labels: [{ name: 'bug' }],
          issueFechada: false,
          ci_status: 'failure'
        },
        {
          number: 2,
          title: 'Teste PR #123',
          head: { ref: 'nexia/feature-123-new' },
          created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          labels: [{ name: 'enhancement' }],
          issueFechada: false,
          ci_status: 'success'
        }
      ]
    };
  },
  async pullsUpdate(owner, repo, pull_number, state) {
    console.log(`Fechando PR #${pull_number}`);
  },
  async issuesCreateComment(owner, repo, issue_number, body) {
    console.log(`Comentário no PR #${issue_number}: ${body}`);
  }
};

function decidir(prs, agora) {
  // Filtrar apenas PRs da branch nexia/
  const prsNexia = prs.filter(pr => pr.headRef && pr.headRef.startsWith('nexia/'));

  // Agrupar PRs por número da issue
  const grupos = new Map();
  for (const pr of prsNexia) {
    const issueNumber = pr.title.match(/#(\d+)/)?.[1];
    if (!issueNumber) continue;
    if (!grupos.has(issueNumber)) grupos.set(issueNumber, []);
    grupos.get(issueNumber).push(pr);
  }

  const fechar = [];

  // Selecionar PRs a fechar
  for (const [issueNumber, grupo] of grupos) {
    if (grupo.length <= 1) continue;

    // Ordenar: CI verde mais novo primeiro, depois mais novo
    grupo.sort((a, b) => {
      if (a.ciStatus === 'success' && b.ciStatus !== 'success') return -1;
      if (a.ciStatus !== 'success' && b.ciStatus === 'success') return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    const manter = grupo[0];

    for (let i = 1; i < grupo.length; i++) {
      const pr = grupo[i];

      // Respeitar exceções de rótulos
      const temExcecao = pr.labels.some(l => EXCECOES_ROTULOS.includes(l.name));
      if (temExcecao) continue;

      // CI vermelho > 48h e issue fechada
      const horas = (agora - new Date(pr.createdAt)) / (1000 * 60 * 60);
      if (pr.ciStatus === 'failure' && horas > 48 && pr.issueFechada) {
        fechar.push({ pr, motivo: 'ci-vermelho-issue-fechada' });
      } else {
        fechar.push({ pr, motivo: 'duplicado' });
      }
    }
  }

  return fechar.slice(0, LIMITE_FECHAMENTOS);
}

async function rodar() {
  // Buscar PRs abertos usando API simulada
  const { data: prs } = await githubApi.pullsList('seu-usuario', 'seu-repositorio', 'open');

  // Filtrar e mapear campos
  const prsParaDecidir = prs
    .filter(pr => pr.head.ref.startsWith('nexia/'))
    .map(pr => ({
      number: pr.number,
      title: pr.title,
      headRef: pr.head.ref,
      createdAt: pr.created_at,
      ciStatus: pr.ci_status || 'pending',
      labels: pr.labels,
      issueFechada: pr.issueFechada === true,
    }));

  const fechar = decidir(prsParaDecidir, new Date());

  for (const { pr, motivo } of fechar) {
    await githubApi.pullsUpdate('seu-usuario', 'seu-repositorio', pr.number, 'closed');

    const body = motivo === 'ci-vermelho-issue-fechada' 
      ? 'Este PR foi fechado automaticamente: CI vermelho há mais de 48h e a issue relacionada já está fechada.'
      : 'Este PR foi fechado automaticamente porque há outro PR mais recente para a mesma issue.';

    await githubApi.issuesCreateComment('seu-usuario', 'seu-repositorio', pr.number, body);
  }

  return fechar.length;
}

module.exports = { decidir, rodar };
