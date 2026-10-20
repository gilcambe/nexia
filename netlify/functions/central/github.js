'use strict';
// Central NEXIA: o que a página precisa do GitHub (fila do Cortex, robôs, posts do Divulga).
// Usa o token da fila (NEXIA_JOBS_TOKEN) só no servidor; nada dele vai para a página.

const REPO = 'gilcambe/nexia';
const API = 'https://api.github.com/repos/' + REPO;

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

  async function postarAgora(horario, tema) {
    // Função mantida para compatibilidade, mas o handler usa implementação local
    const titulo = `Postar agora: ${horario} - ${tema}`;
    const corpo = `Postagem automática agendada para ${horario} com tema: ${tema}\n\nRotina: divulga.yml\nHorário: ${horario}\nTema: ${tema}`;
    const i = await gh('/issues', { method: 'POST', body: JSON.stringify({ title: titulo, body: corpo, labels: ['divulga-agora', 'cortex-fila'] }) });
    return { success: true, numero: i.number, link: i.html_url };
  }

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

  // #802: contas de reserva do Cortex. Só os NOMES dos segredos (o GitHub nunca devolve o valor).
  async function reservas() {
    const nomesDe = async (c) => { try { return ((await gh(c)).secrets || []).map((x) => x.name); } catch { return null; } };
    const [repo, prod] = await Promise.all([nomesDe('/actions/secrets?per_page=100'), nomesDe('/environments/production/secrets?per_page=100')]);
    let semCota = [];
    try { semCota = (await gh('/issues?state=open&labels=cortex-reserva-sem-cota&per_page=20')).filter((i) => !i.pull_request).map(tarefa); } catch { /* sem rótulo ainda */ }
    return montarReservas(repo, prod, semCota);
  }

  return { cortex, robos, rodar, pedirAoCortex, divulga, reservas, temToken: !!token };
}

// Handler HTTP para ações do central/github.js
exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { action, horario, tema } = JSON.parse(event.body);

  // Usar middleware de autenticação do projeto (só dono)
  try {
    const getMw = require('./central');
    const mw = getMw();
    await mw.verifyBearerToken(event);
  } catch (error) {
    return { statusCode: 403, body: JSON.stringify({ success: false, message: 'Unauthorized' }) };
  }

  if (action === 'postarAgora') {
    // Validar entrada
    if (!horario || typeof horario !== 'string' || horario.trim() === '') {
      return { statusCode: 400, body: JSON.stringify({ success: false, message: 'Horário é obrigatório e deve ser uma string não vazia' }) };
    }
    if (!tema || typeof tema !== 'string' || tema.trim() === '') {
      return { statusCode: 400, body: JSON.stringify({ success: false, message: 'Tema é obrigatório e deve ser uma string não vazia' }) };
    }
    
    try {
      // Usar API do GitHub para atualizar o arquivo na branch divulga-dados
      const gh = criarGithub();
      
      // Ler arquivo atual da branch divulga-dados
      const estadoContent = await fetch(`https://raw.githubusercontent.com/${REPO}/divulga-dados/divulga-estado.json`)
        .then(res => res.ok ? res.json() : null)
        .catch(() => null);
      
      let data = estadoContent || { rodizio: 12, feitos: [], historico: [], postagens: [] };
      
      // Garantir que postagens existe
      data.postagens = data.postagens || [];
      
      // Adicionar nova postagem
      const novaPostagem = { 
        horario: horario.trim(), 
        tema: tema.trim(), 
        data: new Date().toISOString() 
      };
      data.postagens.push(novaPostagem);
      
      // Atualizar arquivo via GitHub API
      const response = await fetch(`/contents/divulga-dados/divulga-estado.json`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${process.env.NEXIA_JOBS_TOKEN || process.env.NEXIA_GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        },
        body: JSON.stringify({
          message: `Adicionar postagem: ${horario} - ${tema}`,
          content: Buffer.from(JSON.stringify(data, null, 2)).toString('base64'),
          branch: 'divulga-dados'
        })
      });
      
      if (!response.ok) {
        throw new Error('Falha ao atualizar arquivo no GitHub');
      }
      
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    } catch (error) {
      console.error('Erro ao atualizar divulga-estado.json via GitHub API:', error);
      return { 
        statusCode: 500, 
        body: JSON.stringify({ 
          success: false, 
          message: 'Erro interno ao salvar postagem',
          error: process.env.NODE_ENV === 'development' ? error.message : undefined
        }) 
      };
    }
  }

  return { statusCode: 400, body: JSON.stringify({ success: false, message: 'Invalid action' }) };
};

module.exports = { criarGithub, REPO, RESERVAS, montarReservas, handler };

// Endpoint postarAgora implementado: POST com action:'postarAgora', horario e tema, valida token do dono, atualiza divulga-estado.json
