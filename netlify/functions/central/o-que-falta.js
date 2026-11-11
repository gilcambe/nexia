'use strict';
// #2873 (partes #2906-#2908): aba "O que falta" da Central Kernex. Mostra, numa página só,
// o que está pronto (72 h), o que está com o Cortex (com barra de partes e motivo) e o que espera o dono.
const motivos = require('./motivos');

const nomes = (i) => (i.labels || []).map((l) => l.name || l);
const PARTE = /^\[Parte (\d+)\/(\d+) de #(\d+)\]/;
const SETENTA_E_DUAS_H = 72 * 3600e3;

/** Função pura: recebe as listas do GitHub e monta a página. */
function montar({ abertas = [], fechadas = [], prs = [], agora = Date.now() }) {
  const issues = abertas.filter((i) => !i.pull_request);
  const partesAbertas = {};
  const totalPartes = {};
  for (const i of issues) {
    const m = PARTE.exec(i.title || '');
    if (!m) continue;
    partesAbertas[m[3]] = (partesAbertas[m[3]] || 0) + 1;
    totalPartes[m[3]] = Math.max(totalPartes[m[3]] || 0, Number(m[2]));
  }
  const peso = (i) => { const ls = nomes(i); return ls.includes('cortex-urgente') ? 0 : ls.includes('cortex-prioridade') ? 1 : 2; };
  const pedidos = issues.filter((i) => !PARTE.test(i.title || '') && !nomes(i).includes('vez-do-dono'));
  const comCortex = pedidos
    .map((i) => {
      const total = totalPartes[i.number] || 0;
      const rodando = nomes(i).includes('cortex-rodando') || issues.some((p) => nomes(p).includes('cortex-rodando') && (PARTE.exec(p.title || '') || [])[3] === String(i.number));
      return {
        numero: i.number, titulo: String(i.title || '').slice(0, 120), link: i.html_url, quando: i.updated_at,
        urgente: peso(i) === 0, rodando,
        motivo: rodando ? 'Fazendo agora' : motivos.motivoDe(i).texto,
        partes: total ? { prontas: Math.max(0, total - (partesAbertas[i.number] || 0)), total } : null,
        _peso: peso(i),
      };
    })
    .sort((a, b) => a._peso - b._peso || Number(b.rodando) - Number(a.rodando) || b.numero - a.numero)
    .map(({ _peso, ...x }) => x);

  const esperandoVoce = [
    ...prs.filter((p) => !p.draft && (/^claude\//.test((p.head && p.head.ref) || '') || nomes(p).includes('vez-do-dono') || /workflow/i.test(p.title || '')))
      .map((p) => ({ tipo: 'pr', numero: p.number, titulo: String(p.title || '').slice(0, 120), link: p.html_url, quando: p.updated_at, motivo: 'Abra e toque em Merge (juntar)' })),
    ...issues.filter((i) => nomes(i).includes('vez-do-dono'))
      .map((i) => ({ tipo: 'issue', numero: i.number, titulo: String(i.title || '').slice(0, 120), link: i.html_url, quando: i.updated_at, motivo: 'Precisa de você' })),
  ];

  const seteDiasMs = 7 * 24 * 3600 * 1000;
  // Filtra issues fechadas nos últimos 7 dias, que não sejam PRs e com state_reason diferente de 'not_planned'
  const issuesFechadas7dias = fechadas.filter(
    (i) => !i.pull_request && i.closed_at && agora - Date.parse(i.closed_at) <= seteDiasMs && i.state_reason !== 'not_planned'
  );
  // Filtra PRs juntados nos últimos 7 dias
  const prsJuntados7dias = prs.filter((p) => p.merged_at && agora - Date.parse(p.merged_at) <= seteDiasMs);

  const numIssuesSeteDias = new Set(issuesFechadas7dias.map((i) => i.number));
  const prsCitadosSeteDias = new Set();
  for (const p of prsJuntados7dias) {
    const txt = `${p.title || ''}\\n${p.body || ''}`;
    // Procura por menções de issues (ex: #123) no título e corpo do PR
    const matches = txt.matchAll(/#(\\d+)/g);
    for (const m of matches) {
      prsCitadosSeteDias.add(Number(m[1]));
    }
  }

  // Combina issues fechadas e PRs que citaram issues, removendo duplicatas
  const todasConcluidasNum = new Set([...numIssuesSeteDias, ...prsCitadosSeteDias]);
  const totalConcluidas = todasConcluidasNum.size;

  const prontos = fechadas
    .filter((i) => i.closed_at && agora - Date.parse(i.closed_at) <= SETENTA_E_DUAS_H && (!i.pull_request || (i.pull_request && i.pull_request.merged_at)) && i.state_reason !== 'not_planned')
    .sort((a, b) => Date.parse(b.closed_at) - Date.parse(a.closed_at))
    .slice(0, 40)
    .map((i) => ({ tipo: i.pull_request ? 'pr' : 'issue', numero: i.number, titulo: String(i.title || '').slice(0, 120), link: i.html_url, quando: i.closed_at }));

  return {
    resumo: {
      pedidos: comCortex.length, urgentes: comCortex.filter((x) => x.urgente).length,
      rodando: issues.filter((i) => nomes(i).includes('cortex-rodando')).length,
      travadas: issues.filter((i) => nomes(i).includes('cortex-travado')).length,
      partesNaFila: Object.values(partesAbertas).reduce((s, n) => s + n, 0),
      esperandoVoce: esperandoVoce.length, prontos72h: prontos.length,
      feitas7dias: totalConcluidas, prsJuntados7dias: prsJuntados.length,
      pausada: issues.some((i) => nomes(i).includes('fila-pausada')),
    },
    esperandoVoce, comCortex, prontos, em: new Date(agora).toISOString(),
  };
}

// GraphQL traz só número, título e rótulos: ~750 tarefas cabem em poucos KB (o Worker grátis tem pouco CPU para JSON grande).
const CONSULTA = `query($q:String!,$depois:String){search(query:$q,type:ISSUE,first:100,after:$depois){pageInfo{hasNextPage endCursor}nodes{... on Issue{number title url updatedAt closedAt stateReason labels(first:20){nodes{name}}} ... on PullRequest{number title url updatedAt closedAt mergedAt isDraft headRefName labels(first:20){nodes{name}}}}}}`;
function criarGql(env = process.env, fetchFn = fetch) {
  const token = env.NEXIA_JOBS_TOKEN || env.NEXIA_GITHUB_TOKEN || env.GITHUB_TOKEN || '';
  return async (q, depois = null) => {
    const r = await fetchFn('https://api.github.com/graphql', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'User-Agent': 'nexia-central' }, body: JSON.stringify({ query: CONSULTA, variables: { q, depois } }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.errors) throw new Error((j.errors && j.errors[0] && j.errors[0].message) || 'GitHub respondeu ' + r.status);
    return j.data.search;
  };
}
// Converte o nó do GraphQL para o formato do REST que montar() lê.
const doNo = (n) => ({
  number: n.number, title: n.title, html_url: n.url, updated_at: n.updatedAt, closed_at: n.closedAt,
  state_reason: n.stateReason === 'NOT_PLANNED' ? 'not_planned' : null, draft: !!n.isDraft, head: { ref: n.headRefName || '' },
  labels: ((n.labels && n.labels.nodes) || []).map((l) => ({ name: l.name })),
  ...(n.headRefName !== undefined ? { pull_request: { merged_at: n.mergedAt || null } } : {}),
});
async function todas(gql, q, max = 10) {
  const out = []; let depois = null;
  for (let p = 0; p < max; p++) {
    const s = await gql(q, depois);
    out.push(...(s.nodes || []).filter(Boolean).map(doNo));
    if (!s.pageInfo || !s.pageInfo.hasNextPage) break;
    depois = s.pageInfo.endCursor;
  }
  return out;
}

/** Busca no GitHub e monta. `gql` = criarGql(env) (ou um falso nos testes). */
async function buscar(gql, agora = Date.now(), repo = 'gilcambe/nexia') {
  const desde = new Date(agora - SETENTA_E_DUAS_H).toISOString().slice(0, 16);
  const [abertas, donos, fechadas, prs] = await Promise.all([
    todas(gql, `repo:${repo} is:issue is:open label:cortex-fila`),
    todas(gql, `repo:${repo} is:issue is:open label:vez-do-dono`, 1),
    todas(gql, `repo:${repo} is:closed closed:>=${desde}`, 1),
    todas(gql, `repo:${repo} is:pr is:open`, 1),
  ]);
  for (const d of donos) if (!abertas.some((a) => a.number === d.number)) abertas.push(d);
  return montar({ abertas, fechadas, prs, agora });
}

module.exports = { montar, buscar, criarGql, doNo };
