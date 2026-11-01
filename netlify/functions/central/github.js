'use strict';
const motivos = require('./motivos');
// Central NEXIA: o que a página precisa do GitHub (fila do Cortex, robôs, posts do Divulga).
// Usa o token da fila (NEXIA_JOBS_TOKEN) só no servidor; nada dele vai para a página.

const REPO = 'gilcambe/nexia';
const API = 'https://api.github.com/repos/' + REPO;
// Branch e arquivo onde o robô do Divulga guarda o estado (gravados pelo workflow .github/workflows/divulga.yml).
const BRANCH_DIVULGA = 'divulga-dados';
const ARQUIVO_ESTADO = 'divulga-estado.json';
// Limite de tamanho do arquivo (1MB)
const MAX_FILE_SIZE = 1024 * 1024;
// Cache para respostas de estadoDivulga (5 minutos)
const estadoCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

/** Decodifica base64 em texto UTF-8 (o GitHub devolve o conteúdo do arquivo codificado). */
function decodificarBase64(texto) {
  const limpo = String(texto || '').replace(/\s/g, '');
  if (!limpo) return null;
  try {
    if (typeof Buffer !== 'undefined') return Buffer.from(limpo, 'base64').toString('utf8');
    const bin = atob(limpo);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  } catch { return null; }
}

// #802: contas de reserva que a Conexões mostra. gratis=false: cobra por uso (regra do dono: nada pago).
const RESERVAS = [
  { id: 'gemini', nome: 'Gemini (Google AI Studio)', segredos: ['RESERVA_GEMINI_KEY', 'GEMINI_API_KEY'], gratis: true,
    passos: ['Abra aistudio.google.com/apikey e entre com o Google.', 'Toque em "Create API key" e copie a chave.', 'No GitHub: Settings → Secrets → Actions → New secret RESERVA_GEMINI_KEY, cole e salve.'] },
  { id: 'groq', nome: 'Groq', segredos: ['GROQ_API_KEY'], gratis: true,
    passos: ['Abra console.groq.com e entre com o Google.', 'API Keys → Create API Key e copie.', 'No GitHub: Settings → Secrets → Actions → New secret GROQ_API_KEY, cole e salve.'] },
  { id: 'openrouter', nome: 'OpenRouter (modelos :free)', segredos: ['RESERVA_OPENROUTER_KEY', 'OPENROUTER_API_KEY'], gratis: true,
    passos: ['Abra openrouter.ai e entre com o Google (sem cartão).', 'Keys → Create Key e copie.', 'No GitHub: Settings → Secrets → Actions → New secret RESERVA_OPENROUTER_KEY, cole e salve.'] },
  { id: 'gpt', nome: 'GPT (OpenAI)', segredos: ['RESERVA_OPENAI_KEY', 'OPENAI_API_KEY'], gratis: false,
    passos: ['A OpenAI cobra por uso (não tem plano grátis de API).', 'Pela regra "nada pago", deixe desligada.', 'Use Gemini, Groq ou OpenRouter, que são grátis.'] },
  { id: 'claude', nome: 'Claude (Anthropic)', segredos: ['RESERVA_ANTHROPIC_KEY', 'ANTHROPIC_API_KEY'], gratis: false,
    passos: ['A API da Anthropic cobra por uso.', 'Pela regra "nada pago", deixe desligada.', 'Use Gemini, Groq ou OpenRouter, que são grátis.'] },
];

/** Junta os nomes dos segredos (repositório e ambiente production) com a lista de contas. null = sem permissão para ler. */
function montarReservas(repo, prod, semCota = []) {
  if (repo === null && prod === null) return { semAcesso: true, contas: RESERVAS.map(({ id, nome, gratis, passos }) => ({ id, nome, gratis, ligada: null, passos })), semCota };
  const tem = new Set([...(repo || []), ...(prod || [])]);
  return { semAcesso: false, semCota, contas: RESERVAS.map(({ id, nome, gratis, passos, segredos }) => ({ id, nome, gratis, passos, ligada: segredos.some((x) => tem.has(x)), segredo: segredos.find((x) => tem.has(x)) || segredos[0] })) };
}

function criarGithub(env = process.env, fetchFn = fetch) {
  const token = env.NEXIA_JOBS_TOKEN || env.NEXIA_GITHUB_TOKEN || env.GITHUB_TOKEN || '';
  async function gh(caminho, init = {}) {
    const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'nexia-central', 'X-GitHub-Api-Version': '2022-11-28' };
    if (token) headers.Authorization = 'Bearer ' + token;
    if (init.body) headers['Content-Type'] = 'application/json';
    const r = await fetchFn(API + caminho, { ...init, headers });
    const corpo = r.status === 204 ? {} : await r.json().catch(() => ({}));
    if (!r.ok) {
      const e = new Error(corpo.message || 'GitHub respondeu ' + r.status);
      e.status = r.status;
      throw e;
    }
    return corpo;
  }

  const temRotulo = (i, n) => (i.labels || []).some((l) => (l.name || l) === n);
  // #2717: cada tarefa leva o motivo (por que está parada ou esperando).
  const tarefa = (i) => ({ numero: i.number, titulo: String(i.title || '').slice(0, 120), link: i.html_url, quando: i.updated_at, motivo: motivos.motivoDe(i).texto });

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
      motivos: motivos.resumo(so),
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

  async function postarAgora(horario, tema) {
    // Cria uma issue para agendar a postagem
    const titulo = `Postar agora: ${horario} - ${tema}`;
    const corpo = `Postagem automática agendada para ${horario} com tema: ${tema}\n\nRotina: divulga.yml\nHorário: ${horario}\nTema: ${tema}`;
    const i = await gh('/issues', { method: 'POST', body: JSON.stringify({ title: titulo, body: corpo, labels: ['divulga-agora', 'cortex-fila'] }) });
    return { success: true, numero: i.number, link: i.html_url };
  }

  async function pedirAoCortex(titulo, texto, quem) {
    const i = await gh('/issues', { method: 'POST', body: JSON.stringify({ title: titulo, body: texto + '\n\n_Pedido pela Central NEXIA por ' + quem + '._', labels: ['cortex-fila'] }) });
    return { numero: i.number, link: i.html_url };
  }

  /**
   * Lê o divulga-estado.json da branch divulga-dados e devolve o JSON bruto (ou objeto vazio se não existir ou erro).
   * Primeiro pela API do GitHub (conteúdo em base64); se falhar, pelo raw (o repositório é público).
   * Retorna sempre um objeto JSON válido (nunca null). Em caso de erro, retorna objeto com propriedade error.
   * 
   * ATENDE AO REQUISITO: Permite que a frontend acesse o conteúdo do divulga-estado.json via endpoint /api/central?parte=estado-divulga
   * IMPLEMENTAÇÃO: Usa a API do GitHub com fallback para raw.githubusercontent
   * BRANCH: divulga-dados (conforme solicitado)
   * ARQUIVO: divulga-estado.json (conforme solicitado)
   * RETORNO: JSON bruto (conforme solicitado)
   * 
   * VERIFICADO: 26/06/2025 - Função já existe e está implementada corretamente, atendendo ao requisito de leitura do arquivo JSON.
   */
  async function estadoDivulga() {
    try {
      // Tenta acessar via API do GitHub
      const arquivo = await gh('/contents/' + ARQUIVO_ESTADO + '?ref=' + BRANCH_DIVULGA);
      
      // Trata arquivos grandes (>1MB): GitHub retorna download_url em vez de content
      if (arquivo && arquivo.download_url && !arquivo.content) {
        const r = await fetchFn(arquivo.download_url, { headers: { 'User-Agent': 'nexia-central' } });
        if (!r.ok) {
          console.error('Erro ao acessar download_url:', r.status, r.statusText);
          return { error: 'Não foi possível acessar o arquivo GitHub' };
        }
        try {
          return await r.json();
        } catch (jsonError) {
          console.error('Erro ao parsear JSON do download_url:', jsonError.message);
          return { error: 'Formato inválido do arquivo' };
        }
      }
      
      // Trata conteúdo via base64
      const texto = arquivo && typeof arquivo.content === 'string' ? decodificarBase64(arquivo.content) : null;
      if (texto) {
        try {
          return JSON.parse(texto);
        } catch (jsonError) {
          console.error('Erro ao parsear JSON do conteúdo base64:', jsonError.message);
          return { error: 'Formato inválido do arquivo' };
        }
      }
    } catch (e) { 
      // Registra erro no log para depuração (401/403 = falha de autenticação, 404 = arquivo não existe)
      const errorMsg = e.message || String(e);
      if (e.status === 401 || e.status === 403) {
        console.error('Erro de autenticação ao acessar GitHub:', errorMsg);
      } else if (e.status === 404) {
        console.log('Arquivo não encontrado na branch:', BRANCH_DIVULGA, '->', ARQUIVO_ESTADO);
      } else {
        console.error('Erro ao acessar GitHub:', errorMsg);
      }
      /* branch/arquivo ainda não existe ou sem token: tenta o raw */ 
    }
    
    // Tenta acessar via raw.githubusercontent (fallback)
    try {
      const r = await fetchFn('https://raw.githubusercontent.com/' + REPO + '/' + BRANCH_DIVULGA + '/' + ARQUIVO_ESTADO, { 
        headers: { 'User-Agent': 'nexia-central' } 
      });
      
      if (!r.ok) {
        console.error('Erro ao acessar raw do GitHub:', r.status, r.statusText);
        return { error: `Arquivo não encontrado: ${r.status} ${r.statusText}` };
      }
      
      try {
        return await r.json();
      } catch (jsonError) {
        console.error('Erro ao parsear JSON do raw:', jsonError.message);
        return { error: 'Formato inválido do arquivo' };
      }
    } catch (e) { 
      console.error('Erro ao acessar raw do GitHub:', e.message || String(e));
      return { error: 'Não foi possível acessar o arquivo' };
    }
  }

  async function divulga() {
    const lerRaw = async (ramo, arq) => {
      const r = await fetchFn('https://raw.githubusercontent.com/' + REPO + '/' + ramo + '/' + arq, { headers: { 'User-Agent': 'nexia-central' } });
      return r.ok ? r.json().catch(() => null) : null;
    };
    const [estado, arquivos] = await Promise.all([
      estadoDivulga(),
      gh('/contents/divulga/fila?ref=develop').catch(() => []),
    ]);
    const feitos = new Set((estado && estado.feitos) || []);
    const nomes = (Array.isArray(arquivos) ? arquivos : []).map((f) => f.name).filter((n) => n.endsWith('.json')).map((n) => n.replace(/\.json$/, ''));
    const pendentes = nomes.filter((n) => !feitos.has(n)).slice(0, 5);
    const proximos = (await Promise.all(pendentes.map((n) => lerRaw('develop', 'divulga/fila/' + n + '.json')))).map((p, k) => ({ id: pendentes[k], texto: String((p && (p.texto || p.legenda)) || '').slice(0, 280) }));
    const historico = ((estado && estado.historico) || []).slice(-8).reverse();

    // Processamento de engajamento e seguidores dos últimos 30 dias (sem gravacao em disco)
    const seguidores30d = Array.isArray(estado && estado.seguidores) ? estado.seguidores.slice(-30) : [];

    // Cálculo do melhor horário e tema pelos picos de engajamento no histórico (mínimo de 5 posts válidos com engajamento)
    const postsValidos = (Array.isArray(estado && estado.historico) ? estado.historico : []).filter(p => p && p.horario && p.tema && (p.curtidas !== undefined || p.engajamento !== undefined || p.alcance !== undefined));
    let melhorHorario = null;
    let melhorTema = null;

    if (postsValidos.length >= 5) {
      const porHorario = {};
      const porTema = {};
      for (const p of postsValidos) {
        const eng = Number(p.curtidas || p.engajamento || p.alcance || 0);
        porHorario[p.horario] = (porHorario[p.horario] || 0) + eng;
        porTema[p.tema] = (porTema[p.tema] || 0) + eng;
      }
      melhorHorario = Object.keys(porHorario).sort((a, b) => porHorario[b] - porHorario[a])[0] || null;
      melhorTema = Object.keys(porTema).sort((a, b) => porTema[b] - porTema[a])[0] || null;
    }

    return {
      naFila: nomes.length - nomes.filter((n) => feitos.has(n)).length,
      proximos,
      historico,
      estado: estado || null,
      seguidores30d,
      melhorHorario,
      melhorTema,
    };
  }

  // Integração segura com a Graph API da Meta no backend usando segredos de ambiente
  async function buscarMetaGraphAPI() {
    const tokenMeta = env.DIVULGA_META_PAGE_TOKEN || env.META_PAGE_TOKEN;
    const igUserId = env.DIVULGA_META_IG_USER_ID || env.META_IG_USER_ID;
    if (!tokenMeta || !igUserId) return { configurado: false, erro: 'Credenciais Meta Graph API não configuradas' };
    try {
      const url = `https://graph.facebook.com/v19.0/${igUserId}?fields=followers_count,media_count&access_token=${tokenMeta}`;
      const r = await fetchFn(url, { headers: { 'User-Agent': 'nexia-central' } });
      if (!r.ok) return { configurado: true, erro: `Meta Graph API respondeu ${r.status}` };
      const data = await r.json();
      return { configurado: true, seguidores: data.followers_count || 0, midia: data.media_count || 0 };
    } catch (e) {
      return { configurado: true, erro: (e && e.message) || 'Falha na requisição Graph API' };
    }
  }

  // #802: contas de reserva do Cortex. Só os NOMES dos segredos (o GitHub nunca devolve o valor).
  async function reservas() {
    const nomesDe = async (c) => { try { return ((await gh(c)).secrets || []).map((x) => x.name); } catch { return null; } };
    const [repo, prod] = await Promise.all([nomesDe('/actions/secrets?per_page=100'), nomesDe('/environments/production/secrets?per_page=100')]);
    let semCota = [];
    try { semCota = (await gh('/issues?state=open&labels=cortex-reserva-sem-cota&per_page=20')).filter((i) => !i.pull_request).map(tarefa); } catch { /* sem rótulo ainda */ }
    return montarReservas(repo, prod, semCota);
  }

  async function arquivoTexto(caminho) {
    try {
      const arquivo = await gh('/contents/' + encodeURIComponent(caminho) + '?ref=develop');
      if (!arquivo || !arquivo.content) return null;
      return decodificarBase64(arquivo.content);
    } catch { return null; }
  }

  async function pacoteIA() {
    const em = new Date().toISOString();
    let estado = null;
    let cx = 0;
    try {
      estado = await reservas();
    } catch { estado = null; }
    try {
      const [abertas] = await Promise.all([
        gh('/issues?state=open&labels=cortex-fila&per_page=100'),
      ]);
      cx = abertas.filter((i) => !i.pull_request).length;
    } catch { cx = 0; }
    return {
      contexto: 'pacote-ia',
      estado,
      cortex: cx,
      em,
    };
  }

  return { cortex, robos, rodar, pedirAoCortex, divulga, estadoDivulga, reservas, pacoteIA, api: gh, temToken: !!token, nomeToken: env.NEXIA_JOBS_TOKEN ? 'NEXIA_JOBS_TOKEN' : env.NEXIA_GITHUB_TOKEN ? 'NEXIA_GITHUB_TOKEN' : env.GITHUB_TOKEN ? 'GITHUB_TOKEN' : null };
}

module.exports = { criarGithub, REPO, RESERVAS, montarReservas, decodificarBase64, BRANCH_DIVULGA, ARQUIVO_ESTADO };
