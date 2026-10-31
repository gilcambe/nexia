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

// Funções de API para o Viajante Pro
// Todas as funções usam fetch e incluem autenticação com token

// Obtém o token armazenado em cookie seguro com expiração
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
  document.cookie = name + token + ';' + secure + ' path=/; expires=' + expires.toUTCString();
}

// Remove o token ao fazer logout
function removeToken() {
  document.cookie = 'viajantepro_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
}

// Função auxiliar para fazer requisições API
async function apiRequest(acao, data = {}) {
  const token = getToken();
  if (!token) {
    throw new Error('Token não encontrado. Faça login primeiro.');
  }
  
  const response = await fetch('/api/viajante-pro', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      acao,
      ...data
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Erro na API');
    throw new Error(`Erro na API: ${response.status} - ${errorText}`);
  }
  
  return response.json();
}

// Função auxiliar para validar token no backend (Bearer token é validado no handler viajante-pro.js)

// Funções de Viagem

/**
 * Lista todas as viagens
 * @returns {Promise<Array>} Array de viagens
 * @throws {Error} Se o token não estiver disponível
 */
async function getViagens() {
  const token = getToken();
  if (!token) {
    throw new Error('Token não encontrado. Faça login primeiro.');
  }
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
  const token = getToken();
  if (!token) {
    throw new Error('Token não encontrado. Faça login primeiro.');
  }
  if (!viagem || typeof viagem !== 'object') {
    throw new Error('Viagem deve ser um objeto.');
  }
  if (!viagem.nome || typeof viagem.nome !== 'string') {
    throw new Error('Nome da viagem é obrigatório.');
  }
  if (!viagem.destino || typeof viagem.destino !== 'string') {
    throw new Error('Destino é obrigatório.');
  }
  if (!viagem.datas || typeof viagem.datas !== 'object') {
    throw new Error('Datas são obrigatórias.');
  }
  if (!viagem.datas.inicio || typeof viagem.datas.inicio !== 'string') {
    throw new Error('Data de início é obrigatória.');
  }
  if (!viagem.datas.fim || typeof viagem.datas.fim !== 'string') {
    throw new Error('Data de fim é obrigatória.');
  }
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
  const token = getToken();
  if (!token) {
    throw new Error('Token não encontrado. Faça login primeiro.');
  }
  if (!id || typeof id !== 'string') {
    throw new Error('ID da viagem é obrigatório.');
  }
  if (!viagem || typeof viagem !== 'object') {
    throw new Error('Dados da viagem devem ser um objeto.');
  }
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
  const token = getToken();
  if (!token) {
    throw new Error('Token não encontrado. Faça login primeiro.');
  }
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
  const token = getToken();
  if (!token) {
    throw new Error('Token não encontrado. Faça login primeiro.');
  }
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
  const token = getToken();
  if (!token) {
    throw new Error('Token não encontrado. Faça login primeiro.');
  }
  if (!viagemId || typeof viagemId !== 'string') {
    throw new Error('ID da viagem é obrigatório.');
  }
  if (!texto || typeof texto !== 'string') {
    throw new Error('Texto da mensagem é obrigatório.');
  }
  if (texto.length > 1000) {
    throw new Error('Texto da mensagem excede o limite de 1000 caracteres.');
  }
  if (autor && typeof autor !== 'string') {
    throw new Error('Autor deve ser uma string.');
  }
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
