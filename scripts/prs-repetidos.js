const LIMITE = 15;
const EXCECOES = ['nao-fechar', 'manter'];

const githubApi = {
  async pullsList(owner, repo, state) {
    return { data: [] };
  },
  async pullsUpdate(owner, repo, number, state) {},
  async issuesCreateComment(owner, repo, number, body) {}
};

function decidir(prs, agora) {
  const grupos = new Map();
  for (const pr of prs.filter(p => p.headRef.startsWith('nexia/'))) {
    const issue = pr.title.match(/#(\d+)/)?.[1];
    if (!issue) continue;
    if (!grupos.has(issue)) grupos.set(issue, []);
    grupos.get(issue).push(pr);
  }

  const fechar = [];
  for (const grupo of grupos.values()) {
    if (grupo.length <= 1) continue;
    grupo.sort((a, b) => {
      if (a.ciStatus === 'success' && b.ciStatus !== 'success') return -1;
      if (a.ciStatus !== 'success' && b.ciStatus === 'success') return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    for (let i = 1; i < grupo.length; i++) {
      const pr = grupo[i];
      if (pr.labels.some(l => EXCECOES.includes(l.name))) continue;
      const horas = (agora - new Date(pr.createdAt)) / 3600000;
      const issueFechada = pr.issueFechada === true || pr.issueFechada === 'true' || pr.issue?.closed_at;
      const motivo = (pr.ciStatus === 'failure' && horas > 48 && issueFechada) ? 'ci-vermelho-issue-fechada' : 'duplicado';
      fechar.push({ pr, motivo });
    }
  }
  return fechar.slice(0, LIMITE);
}

async function rodar() {
  try {
    const { data: prs } = await githubApi.pullsList('owner', 'repo', 'open');
    if (!prs) throw new Error('Falha ao listar PRs');
    const entrada = prs
      .filter(p => p.head.ref.startsWith('nexia/'))
      .map(p => ({
        number: p.number,
        title: p.title,
        headRef: p.head.ref,
        createdAt: p.created_at,
        ciStatus: p.ci_status || 'pending',
        labels: p.labels || [],
        issueFechada: p.issue?.closed_at === true || p.issueFechada === true,
      }));
    const fechar = decidir(entrada, new Date());
    let fechados = 0;
    for (const { pr, motivo } of fechar) {
      try {
        await githubApi.pullsUpdate('owner', 'repo', pr.number, 'closed');
        const body = motivo === 'ci-vermelho-issue-fechada'
          ? 'CI vermelho há mais de 48h e issue fechada.'
          : 'PR duplicado: existe PR mais recente para a mesma issue.';
        await githubApi.issuesCreateComment('owner', 'repo', pr.number, body);
        fechados++;
      } catch (e) {
        console.error(`Falha ao fechar PR #${pr.number}:`, e.message);
      }
    }
    return fechados;
  } catch (e) {
    console.error('Erro ao executar rodada:', e.message);
    return 0;
  }
}

module.exports = { decidir, rodar };