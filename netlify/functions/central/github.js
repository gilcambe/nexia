'use strict';
// Central NEXIA: o que a página precisa do GitHub (fila do Cortex, robôs, posts do Divulga).
// Usa o token da fila (NEXIA_JOBS_TOKEN) só no servidor; nada dele vai para a página.

const REPO = 'gilcambe/nexia';
const API = 'https://api.github.com/repos/' + REPO;
// Branch e arquivo onde o robô do Divulga guarda o estado (gravados pelo workflow .github/workflows/divulga.yml).
const BRANCH_DIVULGA = 'divulga-dados';
const ARQUIVO_ESTADO = 'divulga-estado.json';

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

  /**
   * Lê o divulga-estado.json da branch divulga-dados e devolve o JSON bruto (ou null se ainda não existir).
   * Primeiro pela API do GitHub (conteúdo em base64); se falhar, pelo raw (o repositório é público).
   */
  async function lerEstadoDivulga() {
    try {
      const arquivo = await gh('/contents/' + ARQUIVO_ESTADO + '?ref=' + BRANCH_DIVULGA);
      const texto = arquivo && typeof arquivo.content === 'string' ? decodificarBase64(arquivo.content) : null;
      if (texto) return JSON.parse(texto);
    } catch (e) { /* branch/arquivo ainda não existe ou sem token: tenta o raw */ }
    try {
      const r = await fetchFn('https://raw.githubusercontent.com/' + REPO + '/' + BRANCH_DIVULGA + '/' + ARQUIVO_ESTADO, { headers: { 'User-Agent': 'nexia-central' } });
      if (!r.ok) return null;
      return await r.json().catch(() => null);
    } catch { return null; }
  }

  async function divulga() {
    const lerRaw = async (ramo, arq) => {
      const r = await fetchFn('https://raw.githubusercontent.com/' + REPO + '/' + ramo + '/' + arq, { headers: { 'User-Agent': 'nexia-central' } });
      return r.ok ? r.json().catch(() => null) : null;
    };
    const [estado, arquivos] = await Promise.all([
      lerEstadoDivulga(),
      gh('/contents/divulga/fila?ref=develop').catch(() => []),
    ]);
    const feitos = new Set((estado && estado.feitos) || []);
    const nomes = (Array.isArray(arquivos) ? arquivos : []).map((f) => f.name).filter((n) => n.endsWith('.json')).map((n) => n.replace(/\.json$/, ''));
    const pendentes = nomes.filter((n) => !feitos.has(n)).slice(0, 5);
    const proximos = (await Promise.all(pendentes.map((n) => lerRaw('develop', 'divulga/fila/' + n + '.json')))).map((p, k) => ({ id: pendentes[k], texto: String((p && (p.texto || p.legenda)) || '').slice(0, 280) }));
    const historico = ((estado && estado.historico) || []).slice(-8).reverse();
    // `estado` é o JSON bruto do divulga-estado.json: a frontend recebe o arquivo inteiro, não só o resumo.
    return { naFila: nomes.length - nomes.filter((n) => feitos.has(n)).length, proximos, historico, estado: estado || null };
  }

  // #802: contas de reserva do Cortex. Só os NOMES dos segredos (o GitHub nunca devolve o valor).
  async function reservas() {
    const nomesDe = async (c) => { try { return ((await gh(c)).secrets || []).map((x) => x.name); } catch { return null; } };
    const [repo, prod] = await Promise.all([nomesDe('/actions/secrets?per_page=100'), nomesDe('/environments/production/secrets?per_page=100')]);
    let semCota = [];
    try { semCota = (await gh('/issues?state=open&labels=cortex-reserva-sem-cota&per_page=20')).filter((i) => !i.pull_request).map(tarefa); } catch { /* sem rótulo ainda */ }
    return montarReservas(repo, prod, semCota);
  }

  return { cortex, robos, rodar, pedirAoCortex, divulga, estadoDivulga: lerEstadoDivulga, reservas, temToken: !!token };
}

module.exports = { criarGithub, REPO, RESERVAS, montarReservas, decodificarBase64, BRANCH_DIVULGA, ARQUIVO_ESTADO };
