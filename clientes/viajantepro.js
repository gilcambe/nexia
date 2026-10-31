'use strict';
// NEXIA Viajante Pro: conta do cliente/agência de viagens (usada por netlify/functions/viajante-pro.js).

const VIAJANTE_PRO = {
  viajantepro: {
    nome: 'Viajante Pro',
    senhas_iniciais: [
      // ADMIN01 (dono do sistema / suporte)
      { salt: 'd3451e7f34a8549290d4cda5b069c80b', hash: '0752321472aaccfe5e23961d97417d85e6b25587c15a30b6f71e8a2ac650a35c' },
    ],
    versao: 1,
    codigo_salt: 'f880ae6ea10238de715a549b8abb05f2',
    codigo_hash: 'e2d165583a27c742b72aff5b13db118428b7fb093222087a37692a24dfe75a38',
    config: {
      nome: 'Viajante Pro',
      whatsapp: '5511941247074',
      email: 'contato@viajantepro.com.br',
      instagram: 'viajantepro.oficial',
      slogan: 'Sua viagem dos sonhos com consultoria sob medida e experiências exclusivas',
    },
  },
};

// Configuração centralizada da API
const API_CONFIG = {
  baseUrl: '/api/viajante-pro',
  timeout: 10000, // 10 segundos
  maxRetries: 2,
};

// Funções de API para o Viajante Pro
// Todas as funções usam fetch e incluem autenticação com token

// Obtém o token armazenado em cookie (simula HttpOnly no frontend)
// Em produção, o token deve ser lido apenas via HttpOnly cookies no servidor
function getToken() {
  const name = 'viajantepro_token=';
  const decodedCookie = decodeURIComponent(document.cookie);
  const ca = decodedCookie.split(';');
  for(let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name) === 0) {
      return c.substring(name.length, c.length);
    }
  }
  return null;
}

// Salva o token em cookie seguro com expiração de 30 dias
function setToken(token) {
  const name = 'viajantepro_token=';
  const expires = new Date();
  expires.setTime(expires.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 dias
  const secure = window.location.protocol === 'https:' ? 'Secure;' : '';
  const sameSite = 'SameSite=Strict;';
  document.cookie = name + token + ';' + secure + sameSite + ' path=/; expires=' + expires.toUTCString();
}

// Remove o token ao fazer logout
function removeToken() {
  document.cookie = 'viajantepro_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict;';
}

// Gera token CSRF para proteção contra ataques CSRF
function getCsrfToken() {
  const name = 'viajantepro_csrf=';
  const decodedCookie = decodeURIComponent(document.cookie);
  const ca = decodedCookie.split(';');
  for(let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name) === 0) {
      return c.substring(name.length, c.length);
    }
  }
  return null;
}

// Valida estrutura básica de objeto viagem
function validateViagem(viagem) {
  if (!viagem || typeof viagem !== 'object') {
    throw new Error('Viagem deve ser um objeto.');
  }
  
  if (!viagem.nome || typeof viagem.nome !== 'string' || viagem.nome.trim().length === 0) {
    throw new Error('Nome da viagem é obrigatório e deve ser uma string não vazia.');
  }
  
  if (!viagem.destino || typeof viagem.destino !== 'string' || viagem.destino.trim().length === 0) {
    throw new Error('Destino é obrigatório e deve ser uma string não vazia.');
  }
  
  if (!viagem.datas || typeof viagem.datas !== 'object') {
    throw new Error('Datas são obrigatórias e devem ser um objeto.');
  }
  
  if (!viagem.datas.inicio || typeof viagem.datas.inicio !== 'string' || !isValidDate(viagem.datas.inicio)) {
    throw new Error('Data de início é obrigatória e deve ser uma data válida (formato YYYY-MM-DD).');
  }
  
  if (!viagem.datas.fim || typeof viagem.datas.fim !== 'string' || !isValidDate(viagem.datas.fim)) {
    throw new Error('Data de fim é obrigatória e deve ser uma data válida (formato YYYY-MM-DD).');
  }
  
  // Valida que a data de início é anterior à data de fim
  const inicio = new Date(viagem.datas.inicio);
  const fim = new Date(viagem.datas.fim);
  if (inicio >= fim) {
    throw new Error('A data de início deve ser anterior à data de fim.');
  }
  
  // Valida passageiros se existirem
  if (viagem.passageiros && !Array.isArray(viagem.passageiros)) {
    throw new Error('Passageiros devem ser uma array.');
  }
  
  // Valida roteiro se existir
  if (viagem.roteiro && !Array.isArray(viagem.roteiro)) {
    throw new Error('Roteiro deve ser uma array.');
  }
  
  return true;
}

// Valida data no formato YYYY-MM-DD
function isValidDate(dateString) {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;
  
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
}

// Valida mensagem de chat
function validateChatMessage(texto, autor = 'viajante') {
  if (!texto || typeof texto !== 'string' || texto.trim().length === 0) {
    throw new Error('Texto da mensagem é obrigatório e deve ser uma string não vazia.');
  }
  
  if (texto.length > 1000) {
    throw new Error('Texto da mensagem excede o limite de 1000 caracteres.');
  }
  
  if (autor && typeof autor !== 'string') {
    throw new Error('Autor deve ser uma string.');
  }
  
  return true;
}

// Função auxiliar para fazer requisições API com retry e tratamento de erros
async function apiRequest(acao, data = {}, retryCount = 0) {
  const token = getToken();
  if (!token) {
    throw new Error('Token não encontrado. Faça login primeiro.');
  }
  
  // Adiciona token CSRF para proteção contra CSRF
  const csrfToken = getCsrfToken();
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
  
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);
    
    const response = await fetch(API_CONFIG.baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        acao,
        ...data
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    // Trata diferentes status codes
    if (!response.ok) {
      let errorDetails = '';
      try {
        errorDetails = await response.text();
      } catch (e) {
        errorDetails = 'Erro ao ler resposta do servidor';
      }
      
      // Trata erros específicos
      if (response.status === 401) {
        throw new Error('Sessão expirada. Por favor, faça login novamente.');
      } else if (response.status === 403) {
        throw new Error('Acesso negado. Você não tem permissão para esta ação.');
      } else if (response.status === 429) {
        throw new Error('Muitas requisições. Por favor, aguarde alguns minutos.');
      } else {
        throw new Error(`Erro na API: ${response.status} - ${errorDetails}`);
      }
    }
    
    const result = await response.json();
    
    // Verifica se a API retornou um erro no corpo da resposta
    if (result.error) {
      throw new Error(result.error.message || 'Erro na API');
    }
    
    return result;
    
  } catch (error) {
    // Retry para erros de rede ou timeout
    if (retryCount < API_CONFIG.maxRetries && (error.name === 'AbortError' || error.name === 'NetworkError')) {
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
      return apiRequest(acao, data, retryCount + 1);
    }
    
    // Lança erro original se não for retryável
    throw error;
  }
}

// Função auxiliar para validar token no backend (Bearer token é validado no handler viajante-pro.js)

// Funções de Viagem

/**
 * Lista todas as viagens
 * @returns {Promise<Array>} Array de viagens
 * @throws {Error} Se o token não estiver disponível
 */
async function getViagens() {
  const result = await apiRequest('viagem-listar');
  return result.viagens || [];
}

/**
 * Cria uma nova viagem
 * @param {Object} viagem - Dados da viagem
 * @param {string} viagem.nome - Nome da viagem
 * @param {string} viagem.destino - Destino da viagem
 * @param {Object} viagem.datas - Datas de início e fim
 * @param {string} viagem.datas.inicio - Data de início
 * @param {string} viagem.datas.fim - Data de fim
 * @param {Array} viagem.passageiros - Lista de passageiros
 * @param {Array} viagem.roteiro - Roteiro da viagem
 * @returns {Promise<Object>} Viagem criada com ID e link
 * @throws {Error} Se o token não estiver disponível ou parâmetros inválidos
 */
async function criarViagem(viagem) {
  // Valida os dados da viagem
  validateViagem(viagem);
  const result = await apiRequest('viagem-criar', viagem);
  return result;
}

/**
 * Edita uma viagem existente
 * @param {string} id - ID da viagem
 * @param {Object} viagem - Dados atualizados da viagem
 * @returns {Promise<Object>} Viagem atualizada
 * @throws {Error} Se o token não estiver disponível ou parâmetros inválidos
 */
async function editarViagem(id, viagem) {
  if (!id || typeof id !== 'string') {
    throw new Error('ID da viagem é obrigatório.');
  }
  // Valida os dados da viagem
  validateViagem(viagem);
  const result = await apiRequest('viagem-editar', { id, ...viagem });
  return result.viagem;
}

/**
 * Exclui uma viagem
 * @param {string} id - ID da viagem
 * @returns {Promise<Object>} Confirmação de exclusão
 * @throws {Error} Se o token não estiver disponível ou parâmetros inválidos
 */
async function excluirViagem(id) {
  if (!id || typeof id !== 'string') {
    throw new Error('ID da viagem é obrigatório.');
  }
  const result = await apiRequest('viagem-excluir', { id });
  return result;
}

// Funções de Chat

/**
 * Lista as mensagens de um chat específico
 * @param {string} viagemId - ID da viagem
 * @param {string} desde - ID da última mensagem (opcional)
 * @returns {Promise<Object>} Mensagens do chat
 * @throws {Error} Se o token não estiver disponível ou parâmetros inválidos
 */
async function getChats(viagemId, desde) {
  if (!viagemId || typeof viagemId !== 'string') {
    throw new Error('ID da viagem é obrigatório.');
  }
  const data = { v: viagemId };
  if (desde && typeof desde === 'string') {
    data.desde = desde;
  }
  const result = await apiRequest('chat-listar', data);
  return result.mensagens || [];
}

/**
 * Envia uma mensagem no chat
 * @param {string} viagemId - ID da viagem
 * @param {string} texto - Texto da mensagem
 * @param {string} autor - Autor da mensagem (opcional, padrão: 'viajante')
 * @returns {Promise<Object>} Mensagem enviada
 * @throws {Error} Se o token não estiver disponível ou parâmetros inválidos
 */
async function enviarChat(viagemId, texto, autor = 'viajante') {
  if (!viagemId || typeof viagemId !== 'string') {
    throw new Error('ID da viagem é obrigatório.');
  }
  // Valida a mensagem de chat
  validateChatMessage(texto, autor);
  const result = await apiRequest('chat-enviar', { v: viagemId, texto, autor });
  return result.mensagem;
}

// Exporta todas as funções
module.exports = { 
  VIAJANTE_PRO,
  getViagens,
  criarViagem,
  editarViagem,
  excluirViagem,
  getChats,
  enviarChat,
  setToken,
  removeToken
};
