'use strict';
// Cortex no celular (/meu-cortex): os pedidos do Cortex são as issues "cortex-fila" do GitHub.
// O histórico fica guardado lá para sempre, de graça, e não depende da Claude.

const REPO = 'gilcambe/nexia';
const API = 'https://api.github.com';

const nomes = (i) => (i.labels || []).map((l) => l.name || l);
const tentativas = (i) => Math.max(0, ...nomes(i).map((n) => Number((/^tentativa-(\d+)$/.exec(n) || [])[1] || 0)));

function situacao(i) {
  const ls = nomes(i);
  if (i.state === 'closed') return ls.includes('cortex-feito') ? 'feito' : 'fechado';
  if (ls.includes('cortex-travado')) return 'travado';
  if (ls.includes('cortex-rodando')) return 'fazendo';
  if (ls.includes('cortex-dividido')) return 'dividido';
  return 'fila';
}

const resumo = (i) => ({
  numero: i.number, titulo: String(i.title || '').slice(0, 160), situacao: situacao(i),
  criado: i.created_at, quando: i.updated_at, comentarios: i.comments || 0, tentativas: tentativas(i), link: i.html_url,
});

// Primeiras palavras do pedido: o PR do Cortex começa com "Pedido: <texto do pedido>".
const frase = (t) => String(t || '').replace(/[^\p{L}\p{N}\s/.-]/gu, ' ').split(/\s+/).filter(Boolean).slice(0, 8).join(' ');

function criarPedidos(env = process.env, fetchFn = fetch) {
  const token = env.NEXIA_JOBS_TOKEN || env.NEXIA_GITHUB_TOKEN || env.GITHUB_TOKEN || '';
  async function gh(caminho, init = {}) {
    const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'nexia-meu-cortex', 'X-GitHub-Api-Version': '2022-11-28' };
    if (token) headers.Authorization = 'Bearer ' + token;
    if (init.body) headers['Content-Type'] = 'application/json';
    const r = await fetchFn(API + caminho, { ...init, headers });
    const corpo = r.status === 204 ? {} : await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(corpo.message || 'GitHub respondeu ' + r.status);
    return corpo;
  }
  const busca = (q, extra = '') => gh('/search/issues?per_page=30' + extra + '&q=' + encodeURIComponent(q));

  async function lista({ q = '', estado = 'todos', pagina = 1 } = {}) {
    const p = Math.max(1, Math.min(30, Number(pagina) || 1));
    let filtro = 'repo:' + REPO + ' is:issue label:cortex-fila';
    if (estado === 'abertos') filtro += ' is:open -label:cortex-travado';
    if (estado === 'travados') filtro += ' is:open label:cortex-travado';
    if (estado === 'feitos') filtro += ' is:closed';
    const termo = frase(q);
    if (termo) filtro += ' ' + termo;
    const r = await busca(filtro, '&sort=created&order=desc&page=' + p);
    const total = r.total_count || 0;
    return { total, pagina: p, temMais: p * 30 < total, itens: (r.items || []).map(resumo) };
  }

  async function githubRequest(caminho, init = {}) {
    return gh(caminho, init);
  }

  async function ehDono(login) {
    try {
      const usuario = await gh('/user');
      const loginToken = usuario.login || '';
      if (!login) return true;
      return login === loginToken;
    } catch (_) {
      return login === (env.NEXIA_DONO_LOGIN || '');
    }
  }

  return { lista, gh, githubRequest, ehDono, temToken: !!token };
}

async function handleAjudaIas(event, context) {
  const pedidos = criarPedidos(process.env, fetch);
  const { githubRequest, ehDono } = pedidos;

  const headers = event.headers || {};
  const login = headers['x-github-login'] || headers['x-nexia-login'] || '';

  if (!(await ehDono(login))) {
    return { statusCode: 403, body: JSON.stringify({ erro: 'não autorizado' }) };
  }

  if (event.httpMethod === 'GET') {
    // 1. Estado do interruptor
    const qInterruptor = encodeURIComponent('repo:' + REPO + ' is:issue label:interruptor-ajuda "⚙️ Interruptor da ajuda das IAs"');
    const buscaInterruptor = await githubRequest('/search/issues?per_page=1&q=' + qInterruptor);
    let interruptor = 'ligado';
    if (buscaInterruptor.total_count > 0) {
      interruptor = buscaInterruptor.items[0].state === 'open' ? 'ligado' : 'desligado';
    }

    // 2. Última execução do revisor-gratis.yml
    const runs = await githubRequest('/actions/workflows/revisor-gratis.yml/runs?per_page=1');
    const listaRuns = runs.workflow_runs || runs.runs || [];
    const ultimaExecucao = listaRuns[0] || null;

    // 3. Comentários últimas 24h
    const ISO_24H_AGO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const comentarios = await githubRequest('/issues/comments?since=' + encodeURIComponent(ISO_24H_AGO) + '&per_page=100');
    let aprovou = 0;
    let recusou = 0;
    for (const c of (comentarios || [])) {
      const corpo = String(c.body || '');
      if (corpo.startsWith('🪜 Revisor grátis aprovou')) aprovou++;
      if (corpo.startsWith('🪜 Revisor grátis recusou')) recusou++;
    }

    // 4. Issues abertas por label
    const qBase = 'repo:' + REPO + ' is:issue is:open';
    const jules = await githubRequest('/search/issues?per_page=1&q=' + encodeURIComponent(qBase + ' label:jules-enviado'));
    const vez = await githubRequest('/search/issues?per_page=30&q=' + encodeURIComponent(qBase + ' label:vez-do-claude'));
    const travado = await githubRequest('/search/issues?per_page=1&q=' + encodeURIComponent(qBase + ' label:cortex-travado'));

    return {
      statusCode: 200,
      body: JSON.stringify({
        interruptor,
        ultima_execucao_revisor_gratis: ultimaExecucao ? { created_at: ultimaExecucao.created_at, conclusion: ultimaExecucao.conclusion } : null,
        comentarios_24h: { aprovou, recusou },
        issues_abertas: {
          jules_enviado: jules.total_count || 0,
          vez_do_claude: (vez.items || []).map((i) => ({ number: i.number, title: i.title })),
          cortex_travado: travado.total_count || 0,
        },
      }),
    };
  }

  if (event.httpMethod === 'POST') {
    const body = JSON.parse(event.body || '{}');
    const ligar = body.ligar === true;

    const qInterruptor = encodeURIComponent('repo:' + REPO + ' is:issue label:interruptor-ajuda "⚙️ Interruptor da ajuda das IAs"');
    const buscaInterruptor = await githubRequest('/search/issues?per_page=1&q=' + qInterruptor);
    let numero;
    if (buscaInterruptor.total_count > 0) {
      numero = buscaInterruptor.items[0].number;
    } else {
      const criada = await githubRequest('/repos/' + REPO + '/issues', {
        method: 'POST',
        body: JSON.stringify({
          title: '⚙️ Interruptor da ajuda das IAs',
          body: 'Interruptor da ajuda das IAs.',
          labels: ['interruptor-ajuda'],
        }),
      });
      numero = criada.number;
    }

    await githubRequest('/repos/' + REPO + '/issues/' + numero, {
      method: 'PATCH',
      body: JSON.stringify({ state: ligar ? 'open' : 'closed' }),
    });

    const usuario = await pedidos.gh('/user');
    const loginDono = usuario.login || '';
    const iso = new Date().toISOString();
    await githubRequest('/repos/' + REPO + '/issues/' + numero + '/comments', {
      method: 'POST',
      body: JSON.stringify({ body: 'Interruptor alterado por @' + loginDono + ' em ' + iso }),
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, ligar, issue: numero }),
    };
  }

  return { statusCode: 405, body: JSON.stringify({ erro: 'método não permitido' }) };
}

module.exports = { criarPedidos, situacao, resumo, nomes, frase, REPO, handleAjudaIas };
