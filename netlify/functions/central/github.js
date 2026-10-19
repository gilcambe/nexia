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
    const proximos = (await Promise.all(pendentes.map((n) => lerRaw('develop', 'divulga/fila/' + n + '.json')))).map((p, k) => ({
      id: pendentes[k],
      texto: String((p && (p.texto || p.legenda)) || '').slice(0, 280),
      tipo: p && p.tipo ? String(p.tipo) : 'post',
      layout: p && p.layout ? String(p.layout) : layoutDoDia(pendentes[k]),
      midia: p && p.midia ? String(p.midia) : null,
      legendaAuto: p && p.legendaAuto !== undefined ? !!p.legendaAuto : false,
      comentarios: p && p.comentarios ? p.comentarios : [],
      interacoes: p && p.interacoes ? p.interacoes : interacoesDoDia(pendentes[k]),
    }));
    const historico = ((estado && estado.historico) || []).slice(-8).reverse();
    return { naFila: nomes.length - nomes.filter((n) => feitos.has(n)).length, proximos, historico };
  }

  function layoutDoDia(id) {
    const layouts = ['quadrado', 'historia', 'carrossel', 'reel', 'depoimento', 'oferta', 'dica'];
    const i = (id && id.charCodeAt(0) || 0) % layouts.length;
    return layouts[i];
  }

  function interacoesDoDia(id) {
    const lista = [
      'Curtir 3 posts recentes de hashtags do nicho',
      'Comentar em 2 posts de concorrentes com valor real',
      'Responder todos os comentários nos próprios posts',
      'Enviar 5 DMs personalizadas para novos seguidores',
      'Salvar 4 posts de referência do segmento',
      'Compartilhar 2 stories de clientes/parceiros',
      'Seguir 10 perfis alvo do público',
      'Fazer enquete nos stories com pergunta direta',
      'Responder enquetes de 3 perfis da área',
      'Marcar 2 pessoas nos comentários de posts relevantes',
      'Curtir stories de 5 seguidores recentes',
      'Deixar like em 5 posts da aba Explorar',
      'Comentar em post de influenciador do nicho',
      'Repostar conteúdo gerado pelo usuário com crédito',
      'Fazer pergunta nos stories da marca',
      'Responder 3 mensagens diretas pendentes',
      'Salvar 3 reels para referência futura',
      'Interagir com 4 posts de parceiros comerciais',
      'Comentar com emoji relevante em 6 posts recentes',
      'Visitar perfis de 8 pessoas que curtiram a marca',
    ];
    const i = (id && id.charCodeAt(0) || 0) % 7;
    return lista.slice(i * 3, i * 3 + 7).concat(lista.slice((i * 3 + 7) % 21, (i * 3 + 14) % 21)).slice(0, 7);
  }

  async function publicarMeta(corpo) {
    if (!process.env.META_ACCESS_TOKEN && !env.META_ACCESS_TOKEN) {
      throw new Error('Chave da Meta não configurada. Defina META_ACCESS_TOKEN no ambiente.');
    }
    const token = process.env.META_ACCESS_TOKEN || env.META_ACCESS_TOKEN;
    const paginaId = process.env.META_PAGE_ID || env.META_PAGE_ID;
    const instaId = process.env.META_INSTAGRAM_ID || env.META_INSTAGRAM_ID;
    if (!paginaId && !instaId) {
      throw new Error('ID da página do Facebook ou ID do Instagram não configurado.');
    }
    const resultados = [];
    if (paginaId) {
      try {
        const r = await fetchFn('https://graph.facebook.com/v18.0/' + paginaId + '/feed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: corpo.texto || corpo.legenda || '', access_token: token }),
        });
        const b = await r.json().catch(() => ({}));
        resultados.push({ canal: 'facebook', ok: r.ok, id: b.id, erro: b.error ? b.error.message : undefined });
      } catch (e) { resultados.push({ canal: 'facebook', ok: false, erro: String(e.message || e) }); }
    }
    if (instaId) {
      try {
        const r = await fetchFn('https://graph.facebook.com/v18.0/' + instaId + '/media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ caption: corpo.texto || corpo.legenda || '', access_token: token }),
        });
        const b = await r.json().catch(() => ({}));
        resultados.push({ canal: 'instagram', ok: r.ok, id: b.id, erro: b.error ? b.error.message : undefined });
      } catch (e) { resultados.push({ canal: 'instagram', ok: false, erro: String(e.message || e) }); }
    }
    return resultados;
  }

  async function responderComentario(corpo) {
    const token = process.env.META_ACCESS_TOKEN || env.META_ACCESS_TOKEN;
    if (!token) throw new Error('Chave da Meta não configurada para responder comentários.');
    if (!corpo.comentarioId) throw new Error('ID do comentário não informado.');
    try {
      const r = await fetchFn('https://graph.facebook.com/v18.0/' + corpo.comentarioId + '/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: corpo.resposta || '', access_token: token }),
      });
      const b = await r.json().catch(() => ({}));
      return { ok: r.ok, id: b.id, erro: b.error ? b.error.message : undefined };
    } catch (e) { return { ok: false, erro: String(e.message || e) }; }
  }

  return { cortex, robos, rodar, pedirAoCortex, divulga, publicarMeta, responderComentario, temToken: !!token };
}

module.exports = { criarGithub, REPO };
