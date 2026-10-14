const fs = require('fs');
const path = require('path');

const ESTADO_PATH = path.join(__dirname, 'estado.json');
const ESTADO_TMP_PATH = path.join(__dirname, 'estado.json.tmp');

// Domínios permitidos para prevenção de SSRF
const DOMINIOS_PERMITIDOS = [
  'api.twitter.com',
  'api.linkedin.com',
  'graph.facebook.com'
];

// Rate limiting simples: tempo mínimo entre chamadas por canal (ms)
const RATE_LIMIT_MS = 1000;
const ultimoRequestPorCanal = new Map();

function carregarEstado() {
  const raw = fs.readFileSync(ESTADO_PATH, 'utf-8');
  return JSON.parse(raw);
}

function salvarEstado(estado) {
  // Escrita atômica: escreve em .tmp e depois renomeia
  fs.writeFileSync(ESTADO_TMP_PATH, JSON.stringify(estado, null, 2), 'utf-8');
  fs.renameSync(ESTADO_TMP_PATH, ESTADO_PATH);
}

function validarCliente(cliente) {
  const camposObrigatorios = ['id', 'nome', 'utm_source', 'utm_medium', 'utm_campaign'];
  for (const campo of camposObrigatorios) {
    if (!cliente[campo] || typeof cliente[campo] !== 'string' || cliente[campo].trim() === '') {
      throw new Error(`Cliente inválido: campo obrigatório ausente ou vazio: ${campo}`);
    }
  }
  return true;
}

function escolherProximoCliente(estado) {
  const { clientes, rodizioIndex } = estado;
  if (!clientes || clientes.length === 0) {
    return null;
  }
  const cliente = clientes[rodizioIndex % clientes.length];
  validarCliente(cliente);
  estado.rodizioIndex = (rodizioIndex + 1) % clientes.length;
  return cliente;
}

function gerarPost(cliente) {
  const baseUrl = 'https://exemplo.com/oferta';
  const utmParams = new URLSearchParams({
    utm_source: cliente.utm_source,
    utm_medium: cliente.utm_medium,
    utm_campaign: cliente.utm_campaign
  }).toString();
  const link = `${baseUrl}?${utmParams}`;
  return `Confira a novidade de ${cliente.nome}: ${link}`;
}

function validarEndpoint(endpoint) {
  try {
    const url = new URL(endpoint);
    const hostname = url.hostname;
    // Verifica se o domínio está na allow-list
    const permitido = DOMINIOS_PERMITIDOS.some(dominio => hostname === dominio || hostname.endsWith('.' + dominio));
    if (!permitido) {
      throw new Error(`Domínio não permitido: ${hostname}`);
    }
    // Bloqueia endereços locais/privados
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('169.254.') || hostname.startsWith('10.') || hostname.startsWith('192.168.') || hostname.startsWith('172.')) {
      throw new Error(`Endereço local/privado bloqueado: ${hostname}`);
    }
    return true;
  } catch (error) {
    if (error.message.includes('não permitido') || error.message.includes('bloqueado')) {
      throw error;
    }
    throw new Error(`Endpoint inválido: ${endpoint}`);
  }
}

function obterToken(canal) {
  // Tokens vêm de variáveis de ambiente, não do estado.json
  const envVar = canal.tokenEnv;
  if (!envVar) {
    throw new Error(`Canal ${canal.nome} não possui tokenEnv configurado`);
  }
  const token = process.env[envVar];
  if (!token) {
    throw new Error(`Variável de ambiente ${envVar} não definida para canal ${canal.nome}`);
  }
  return token;
}

async function aguardarRateLimit(canalId) {
  const agora = Date.now();
  const ultimoRequest = ultimoRequestPorCanal.get(canalId) || 0;
  const tempoDecorrido = agora - ultimoRequest;
  if (tempoDecorrido < RATE_LIMIT_MS) {
    const espera = RATE_LIMIT_MS - tempoDecorrido;
    await new Promise(resolve => setTimeout(resolve, espera));
  }
  ultimoRequestPorCanal.set(canalId, Date.now());
}

async function publicarNoCanal(canal, texto) {
  // Valida endpoint antes de usar (prevenção SSRF)
  validarEndpoint(canal.endpoint);
  
  // Valida tokenEnv antes de tentar obter o token (erro de configuração)
  if (!canal.tokenEnv) {
    return { sucesso: false, canal: canal.nome, erro: 'Configuração inválida: tokenEnv ausente' };
  }
  
  let token;
  try {
    token = obterToken(canal);
  } catch (error) {
    return { sucesso: false, canal: canal.nome, erro: `Configuração inválida: ${error.message}` };
  }
  
  // Rate limiting
  await aguardarRateLimit(canal.id);
  
  // Timeout de 10 segundos
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  
  try {
    const response = await fetch(canal.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text: texto }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      // Não expõe corpo da resposta - apenas status genérico
      throw new Error(`HTTP ${response.status}`);
    }
    return { sucesso: true, canal: canal.nome };
  } catch (error) {
    clearTimeout(timeoutId);
    // Sanitiza erro: não vaza detalhes da resposta da API externa
    let mensagemErro;
    if (error.name === 'AbortError') {
      mensagemErro = 'Timeout (10s)';
    } else if (error.message.startsWith('HTTP ')) {
      mensagemErro = error.message;
    } else {
      mensagemErro = 'Erro de rede';
    }
    return { sucesso: false, canal: canal.nome, erro: mensagemErro };
  }
}

async function executar() {
  const estado = carregarEstado();
  const cliente = escolherProximoCliente(estado);
  
  if (!cliente) {
    console.log('Nenhum cliente configurado.');
    return { sucesso: false, motivo: 'sem_clientes' };
  }

  const texto = gerarPost(cliente);
  const canaisAtivos = estado.canais.filter(c => c.ativo);

  if (canaisAtivos.length === 0) {
    console.log('--- MODO ENSAIO ---');
    console.log(`Cliente: ${cliente.nome}`);
    console.log(`Texto: ${texto}`);
    salvarEstado(estado);
    return { sucesso: true, modo: 'ensaio', cliente: cliente.nome, texto };
  }

  const resultados = [];
  for (const canal of canaisAtivos) {
    const resultado = await publicarNoCanal(canal, texto);
    resultados.push(resultado);
    if (resultado.sucesso) {
      console.log(`Publicado em ${canal.nome}`);
    } else {
      console.error(`Erro em ${canal.nome}: ${resultado.erro}`);
    }
  }

  salvarEstado(estado);
  return { sucesso: true, cliente: cliente.nome, resultados };
}

module.exports = { executar, carregarEstado, salvarEstado, escolherProximoCliente, gerarPost, publicarNoCanal, validarCliente, validarEndpoint, obterToken };