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

  async function salvarDadosMeta(dados) {
    // Extrair dados recebidos
    const { seguidores, alcance, curtidas, melhorHorario, tema } = dados;
    
    // Criar data atual
    const hoje = new Date();
    const dataFormatada = hoje.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Criar amostra diária
    const amostra = {
      data: dataFormatada,
      timestamp: hoje.toISOString(),
      seguidores,
      alcance,
      curtidas,
      melhorHorario,
      tema
    };
    
    // Ler arquivo de estado existente
    try {
      const estadoPath = 'divulga-dados/divulga-estado.json';
      const estadoRaw = await fetchFn(`https://raw.githubusercontent.com/${REPO}/develop/${estadoPath}`, { 
        headers: { 'User-Agent': 'nexia-central' } 
      });
      
      let estado = {};
      if (estadoRaw.ok) {
        try {
          estado = await estadoRaw.json();
        } catch (e) {
          console.error('Erro ao parsear estado:', e);
        }
      }
      
      // Garantir que a estrutura correta exista
      estado.feitos = estado.feitos || [];
      estado.historico = estado.historico || [];
      
      // Adicionar nova amostra ao histórico
      estado.historico.push(amostra);
      
      // Manter apenas os últimos 30 dias de histórico
      if (estado.historico.length > 30) {
        estado.historico = estado.historico.slice(-30);
      }
      
      // Atualizar arquivo de estado
      await fetchFn(`https://api.github.com/repos/${REPO}/contents/${estadoPath}`, {
        method: 'PUT',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        },
        body: JSON.stringify({
          message: `Atualizar estado do Meta - ${dataFormatada}`,
          content: Buffer.from(JSON.stringify(estado, null, 2)).toString('base64'),
          sha: estadoRaw.headers.get('ETag') || undefined
        })
      });
      
      return { sucesso: true, data: amostra };
    } catch (error) {
      console.error('Erro ao salvar dados do Meta:', error);
      throw new Error(`Falha ao salvar dados do Meta: ${error.message}`);
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

  async function salvarDadosMeta(dados) {
    const hoje = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const caminhoArquivo = 'divulga-dados/divulga-estado.json';
    
    // Estrutura dos dados a serem salvos
    const novaAmostra = {
      quando: new Date().toISOString(),
      id: null,
      cliente: 'meta',
      resultados: [
        {
          canal: 'meta',
          seguidores: dados.seguidores || 0,
          alcance: dados.alcance || 0,
          curtidas: dados.curtidas || 0,
          melhorHorario: dados.melhorHorario || null,
          tema: dados.tema || null,
          ok: true
        }
      ]
    };
    
    try {
      // Tenta obter o SHA do arquivo na branch divulga-dados
      const arquivoInfo = await fetch(`https://api.github.com/repos/${REPO}/contents/${caminhoArquivo}?ref=divulga-dados`, {
        headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github.v3+json' }
      });
      
      const dadosAtuais = { historico: [] };
      let sha = null;
      
      if (arquivoInfo.ok) {
        const fileInfo = await arquivoInfo.json();
        sha = fileInfo.sha;
        
        // Tenta ler o conteúdo atual do arquivo
        try {
          const arquivoContent = await fetch(`https://raw.githubusercontent.com/${REPO}/divulga-dados/${caminhoArquivo}`, {
            headers: { 'User-Agent': 'nexia-central' }
          });
          
          if (arquivoContent.ok) {
            dadosAtuais.historico = await arquivoContent.json().then(data => data.historico || []);
          }
        } catch (e) {
          console.error('Erro ao ler conteúdo do arquivo:', e);
        }
      }
      
      // Adiciona a nova amostra ao histórico
      dadosAtuais.historico.push(novaAmostra);
      
      // Mantém apenas as últimas 100 amostras para não crescer indefinidamente
      if (dadosAtuais.historico.length > 100) {
        dadosAtuais.historico = dadosAtuais.historico.slice(-100);
      }
      
      // Atualiza ou cria o arquivo
      await fetch(`https://api.github.com/repos/${REPO}/contents/${caminhoArquivo}`, {
        method: 'PUT',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github.v3+json'
        },
        body: JSON.stringify({
          message: `Atualizar dados da Meta para ${hoje}`,
          content: Buffer.from(JSON.stringify(dadosAtuais, null, 2)).toString('base64'),
          sha: sha
        })
      });
      
      return { sucesso: true, arquivo: caminhoArquivo };
    } catch (error) {
      console.error('Erro ao salvar dados da Meta:', error);
      return { sucesso: false, erro: error.message };
    }
  }

  return { cortex, robos, rodar, pedirAoCortex, divulga, reservas, salvarDadosMeta, temToken: !!token };
}

module.exports = { criarGithub, REPO, RESERVAS, montarReservas, salvarDadosMeta };
