'use strict';
// Central NEXIA: o que a página precisa do GitHub (fila do Cortex, robôs, posts do Divulga).
// Usa o token da fila (NEXIA_JOBS_TOKEN) só no servidor; nada dele vai para a página.

const REPO = 'gilcambe/nexia';
const API = 'https://api.github.com/repos/' + REPO;

function criarGithub(env = process.env, fetchFn = fetch) {
  const token = env.NEXIA_JOBS_TOKEN || env.NEXIA_GITHUB_TOKEN || env.GITHUB_TOKEN || '';
  async function gh(caminho, init = {}) {
    const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'nexia-central', 'X-GitHub-Api-Version': '2022-11-28' };
    if (token) headers.Authorization = 'Bearer ' + token;
    if (init.body) headers['Content-Type'] = 'application/json';
    const r = await fetchFn(API + caminho, { ...init, headers });
    const corpo = r.status === 204 ? {} : await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(corpo.message || 'GitHub respondeu ' + r.status);
    return corpo;
  }

  const temRotulo = (i, n) => (i.labels || []).some((l) => (l.name || l) === n);
  const tarefa = (i) => ({ numero: i.number, titulo: String(i.title || '').slice(0, 120), link: i.html_url, quando: i.updated_at });

  async function cortex() {
    const semana = new Date(Date.now() - 7 * 864e5).toISOString();
    const [abertas, feitas] = await Promise.all([
      gh('/issues?state=open&labels=cortex-fila&per_page=100'),
      gh('/issues?state=closed&labels=cortex-feito&per_page=30&sort=updated&since=' + semana),
    ]);
    const so = abertas.filter((i) => !i.pull_request && !temRotulo(i, 'cortex-dividido'));
    const travadas = so.filter((i) => temRotulo(i, 'cortex-travado'));
    const fazendo = so.filter((i) => temRotulo(i, 'cortex-rodando'));
    const naFila = so.filter((i) => !temRotulo(i, 'cortex-travado') && !temRotulo(i, 'cortex-rodando'));
    const entregues = feitas.filter((i) => !i.pull_request && i.closed_at >= semana);
    return {
      naFila: naFila.length, fazendo: fazendo.map(tarefa), travadas: travadas.map(tarefa),
      feitas7: entregues.length, ultimas: entregues.slice(0, 8).map(tarefa), proximas: naFila.slice(0, 8).map(tarefa),
    };
  }

  async function robos(lista) {
    return Promise.all(lista.map(async (r) => {
      try {
        const runs = (await gh('/actions/workflows/' + r.arquivo + '/runs?per_page=1&exclude_pull_requests=true')).workflow_runs || [];
        const u = runs[0];
        return { arquivo: r.arquivo, nome: r.nome, podeRodar: !!r.inputs,
          situacao: !u ? 'nunca' : u.status !== 'completed' ? 'rodando' : u.conclusion === 'success' ? 'ok' : 'erro',
          quando: u ? u.updated_at : null, link: u ? u.html_url : null };
      } catch (e) { return { arquivo: r.arquivo, nome: r.nome, podeRodar: !!r.inputs, situacao: 'sem-acesso', quando: null, link: null }; }
    }));
  }

  const rodar = (arquivo, inputs) => gh('/actions/workflows/' + arquivo + '/dispatches', { method: 'POST', body: JSON.stringify({ ref: 'develop', inputs }) });

  async function pedirAoCortex(titulo, texto, quem) {
    const i = await gh('/issues', { method: 'POST', body: JSON.stringify({ title: titulo, body: texto + '\n\n_Pedido pela Central NEXIA por ' + quem + '._', labels: ['cortex-fila'] }) });
    return { numero: i.number, link: i.html_url };
  }

  async function divulga() {
    const lerRaw = async (ramo, arq) => {
      const r = await fetchFn('https://raw.githubusercontent.com/' + REPO + '/' + ramo + '/' + arq, { headers: { 'User-Agent': 'nexia-central' } });
      return r.ok ? r.json().catch(() => null) : null;
    };
    const [estado, arquivos] = await Promise.all([
      lerRaw('divulga-dados', 'divulga-estado.json'),
      gh('/contents/divulga/fila?ref=develop').catch(() => []),
    ]);
    const feitos = new Set((estado && estado.feitos) || []);
    const nomes = (Array.isArray(arquivos) ? arquivos : []).map((f) => f.name).filter((n) => n.endsWith('.json')).map((n) => n.replace(/\.json$/, ''));
    const pendentes = nomes.filter((n) => !feitos.has(n)).slice(0, 5);
    const proximos = (await Promise.all(pendentes.map((n) => lerRaw('develop', 'divulga/fila/' + n + '.json')))).map((p, k) => ({ id: pendentes[k], texto: String((p && (p.texto || p.legenda)) || '').slice(0, 280) }));
    const historico = ((estado && estado.historico) || []).slice(-8).reverse();
    return { naFila: nomes.length - nomes.filter((n) => feitos.has(n)).length, proximos, historico };
  }

  async function metaGraphAPI() {
    // Verifica se temos a chave da Graph API configurada
    const metaToken = env.NEXIA_META_TOKEN || env.META_TOKEN || '';
    if (!metaToken) {
      return { 
        temChave: false, 
        mensagem: 'Chave da Graph API não configurada. Crie um arquivo "configurar-meta.bat" com as instruções para configurar.' 
      };
    }

    try {
      // Busca dados da Graph API
      const baseUrl = 'https://graph.facebook.com/v18.0';
      const access_token = metaToken;
      
      // Busca seguidores
      const followersResponse = await fetchFn(`${baseUrl}/me?fields=followers_count&access_token=${access_token}`);
      const followers = followersResponse.followers_count || 0;
      
      // Busca dados dos posts recentes
      const postsResponse = await fetchFn(`${baseUrl}/me/posts?fields=id,message,created_time,likes.limit(1).summary(true),comments.limit(1).summary(true),shares&limit=50&access_token=${access_token}`);
      const posts = postsResponse.data || [];
      
      // Calcula métricas
      const totalLikes = posts.reduce((sum, post) => sum + (post.likes?.summary?.total_count || 0), 0);
      const totalComments = posts.reduce((sum, post) => sum + (post.comments?.summary?.total_count || 0), 0);
      const totalShares = posts.reduce((sum, post) => sum + (post.shares?.count || 0), 0);
      const totalReach = posts.reduce((sum, post) => sum + (post.impression_count || 0), 0);
      
      // Agrupa por hora para encontrar melhor horário
      const postsByHour = {};
      posts.forEach(post => {
        if (post.created_time) {
          const date = new Date(post.created_time);
          const hour = date.getHours();
          if (!postsByHour[hour]) {
            postsByHour[hour] = { count: 0, likes: 0, comments: 0, shares: 0 };
          }
          postsByHour[hour].count++;
          postsByHour[hour].likes += (post.likes?.summary?.total_count || 0);
          postsByHour[hour].comments += (post.comments?.summary?.total_count || 0);
          postsByHour[hour].shares += (post.shares?.count || 0);
        }
      });
      
      // Encontra melhor horário
      let bestHour = 0;
      let bestEngagement = 0;
      Object.keys(postsByHour).forEach(hour => {
        const engagement = postsByHour[hour].likes + postsByHour[hour].comments + postsByHour[hour].shares;
        if (engagement > bestEngagement) {
          bestEngagement = engagement;
          bestHour = parseInt(hour);
        }
      });
      
      // Busca dados históricos de divulga-dados
      const dadosHistoricos = await lerRaw('divulga-dados', 'divulga-metricas.json') || [];
      
      // Adiciona amostra do dia atual
      const hoje = new Date().toISOString().split('T')[0];
      const novaAmostra = {
        data: hoje,
        seguidores: followers,
        curtidas: totalLikes,
        comentarios: totalComments,
        compartilhamentos: totalShares,
        alcance: totalReach,
        melhorHorario: bestHour,
        posts: posts.length
      };
      
      // Mantém apenas as últimas 30 amostras
      const ultimasAmostras = [...dadosHistoricos, novaAmostra].slice(-30);
      
      return {
        temChave: true,
        seguidores,
        curtidas: totalLikes,
        comentarios: totalComments,
        compartilhamentos: totalShares,
        alcance: totalReach,
        melhorHorario: bestHour,
        posts: posts.length,
        historico: ultimasAmostras,
        mensagem: 'Dados da Graph API atualizados com sucesso'
      };
    } catch (error) {
      console.error('Erro ao acessar Graph API:', error);
      return {
        temChave: true,
        erro: 'Erro ao acessar Graph API: ' + error.message,
        mensagem: 'Não foi possível obter os dados da Graph API'
      };
    }
  }

  return { cortex, robos, rodar, pedirAoCortex, divulga, metaGraphAPI, temToken: !!token };
}

module.exports = { criarGithub, REPO };
