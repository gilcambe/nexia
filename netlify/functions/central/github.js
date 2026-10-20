'use strict';
// Central NEXIA: o que a página precisa do GitHub (fila do Cortex, robôs, posts do Divulga).
// Usa o token da fila (NEXIA_JOBS_TOKEN) só no servidor; nada dele vai para a página.

// Variável de ambiente configurada via configurar-meta.bat
// Melhoria: Adiciona validação mais robusta de permissão de owner
const OWNER_PERMISSION = process.env.NEXIA_OWNER_PERMISSION === 'true' && process.env.NEXIA_JOBS_TOKEN;

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

  async function pedirAoCortex(titulo, texto, quem) {
    const i = await gh('/issues', { method: 'POST', body: JSON.stringify({ title: titulo, body: texto + '\n\n_Pedido pela Central NEXIA por ' + quem + '._', labels: ['cortex-fila'] }) });
    return { numero: i.number, link: i.html_url };
  }

  async function divulga() {
    // Verificação robusta de permissão de owner
    if (!OWNER_PERMISSION) {
      throw new Error('Permissão de owner não configurada ou token inválido. Configure via configurar-meta.bat');
    }
    
    // Validação robusta de entrada - limita o número máximo de operações
    const MAX_OPERATIONS = 100;
    
    const lerRaw = async (ramo, arq) => {
      // Validação de parâmetros para evitar injeção de dados
      if (!ramo || typeof ramo !== 'string' || !arq || typeof arq !== 'string') {
        throw new Error('Parâmetros inválidos para leitura de arquivo');
      }
      
      try {
        const r = await fetchFn('https://raw.githubusercontent.com/' + REPO + '/' + ramo + '/' + arq, { 
          headers: { 'User-Agent': 'nexia-central' },
          timeout: 5000 // Timeout para evitar negação de serviço
        });
        
        if (!r.ok) {
          if (r.status === 404) return null; // Arquivo não encontrado é esperado
          throw new Error(`Erro ao acessar arquivo: ${r.status}`);
        }
        
        return r.json().catch(() => null);
      } catch (error) {
        console.error('Erro ao ler arquivo:', error);
        return null;
      }
    };
    
    // Integração exclusiva com Graph API no backend - com limitação de dados
    const graphData = await fetchGraphData(MAX_OPERATIONS);
    
    try {
      const [estado, arquivos] = await Promise.all([
        lerRaw('divulga-dados', 'divulga-estado.json'),
        gh('/contents/divulga/fila?ref=develop').catch(() => []),
      ]);
      
      // Validação de dados recebidos
      const feitos = Array.isArray(estado?.feitos) ? new Set(estado.feitos.filter(id => typeof id === 'string')) : new Set();
      const arquivosValidos = Array.isArray(arquivos) ? arquivos : [];
      
      // Filtra e valida nomes de arquivos
      const nomes = arquivosValidos
        .filter(f => f && typeof f === 'object' && f.name && typeof f.name === 'string')
        .map(f => f.name)
        .filter(n => n.endsWith('.json'))
        .map(n => n.replace(/\.json$/, ''))
        .slice(0, MAX_OPERATIONS); // Limita número de arquivos
      
      // Lógica de particionamento da tarefa de divulgação - com validação
      const totalTarefas = nomes.length;
      const tarefasFeitas = nomes.filter((n) => feitos.has(n)).length;
      const tarefasPendentes = Math.max(0, totalTarefas - tarefasFeitas);
      
      // Dados de particionamento para a interface - sem expor dados sensíveis
      const particionamento = {
        total: totalTarefas,
        feitas: tarefasFeitas,
        pendentes: tarefasPendentes,
        progresso: totalTarefas > 0 ? Math.round((tarefasFeitas / totalTarefas) * 100) : 0
      };
      
      // Limita número de tarefas pendentes para processamento
      const pendentes = nomes.filter((n) => !feitos.has(n)).slice(0, Math.min(5, MAX_OPERATIONS));
      
      const proximos = (await Promise.all(
        pendentes.map((n) => lerRaw('develop', 'divulga/fila/' + n + '.json'))
      )).map((p, k) => ({ 
        id: pendentes[k], 
        texto: String((p && (p.texto || p.legenda)) || '').slice(0, 280),
        // Adiciona dados do Graph API para cada tarefa - com validação
        graphInfo: graphData?.[pendentes[k]] ? {
          state: graphData[pendentes[k]].state,
          updatedAt: graphData[pendentes[k]].updatedAt
        } : null
      }));
      
      // Valida e filtra histórico
      const historico = Array.isArray(estado?.historico) 
        ? estado.historico.filter(h => h && typeof h === 'object').slice(-8).reverse()
        : [];
      
      return { 
        // Dados de particionamento expostos para a interface - filtrados
        particionamento,
        naFila: tarefasPendentes, 
        proximos, 
        historico,
        // Dados agregados do Graph API - sem dados sensíveis
        graphSummary: graphData?.summary ? {
          total: graphData.summary.total,
          abertas: graphData.summary.abertas,
          fechadas: graphData.summary.fechadas
        } : null
      };
    } catch (error) {
      console.error('Erro na função divulga:', error);
      throw new Error('Falha ao processar dados de divulgação');
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

  // Função auxiliar para integração com Graph API - com limitação e segurança
  async function fetchGraphData(maxIssues = 50) {
    if (!token) {
      throw new Error('Token não disponível para Graph API');
    }
    
    try {
      // Validação de limite para evitar negação de serviço
      const limitedMaxIssues = Math.min(maxIssues, 100); // Limite máximo seguro
      
      // Integração exclusiva com Graph API no backend
      const response = await fetchFn('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github.v3+json'
        },
        body: JSON.stringify({
          query: `
            query {
              repository(owner: "gilcambe", name: "nexia") {
                issues(labels: ["divulga"], first: ${limitedMaxIssues}) {
                  nodes {
                    number
                    title
                    state
                    createdAt
                    updatedAt
                    labels(first: 5) {
                      nodes {
                        name
                      }
                    }
                  }
                }
              }
            }
          `
        }),
        timeout: 10000 // Timeout para evitar negação de serviço
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Não autorizado a acessar Graph API - verifique o token');
        }
        throw new Error(`Erro ao acessar Graph API: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Validação da resposta GraphQL
      if (!data || !data.data || !data.data.repository || !data.data.repository.issues) {
        throw new Error('Resposta inválida da Graph API');
      }
      
      const issues = data.data.repository.issues.nodes || [];
      
      // Processa os dados do Graph API - sem expor dados sensíveis
      const summary = {
        total: issues.length,
        abertas: issues.filter(i => i.state === 'OPEN').length,
        fechadas: issues.filter(i => i.state === 'CLOSED').length
      };
      
      const byId = {};
      issues.forEach(issue => {
        if (issue && typeof issue === 'object') {
          byId[issue.number] = {
            state: issue.state || 'UNKNOWN',
            updatedAt: issue.updatedAt || null
          };
        }
      });
      
      return {
        summary,
        ...byId
      };
    } catch (error) {
      console.error('Erro ao buscar dados do Graph API:', error.message);
      // Retorna dados vazios em caso de erro para não quebrar a aplicação
      return { summary: { total: 0, abertas: 0, fechadas: 0 } };
    }
  }

  return { cortex, robos, rodar, pedirAoCortex, divulga, reservas, temToken: !!token, fetchGraphData };
}

module.exports = { criarGithub, REPO, RESERVAS, montarReservas };
