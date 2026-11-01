'use strict';
// NEXIA Viajante Pro: conta do cliente/agência de viagens (usada por netlify/functions/viajante-pro.js).

/**
 * API client para Viajante Pro
 * @module viajantepro
 */

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

// Função para obter o token armazenado
const getToken = () => {
  return localStorage.getItem('token');
};

// Função auxiliar para tratar respostas HTTP
const handleResponse = async (response) => {
  if (!response.ok) {
    const error = new Error(`HTTP error! status: ${response.status}`);
    error.status = response.status;
    try {
      error.data = await response.json();
    } catch (e) {
      error.data = await response.text();
    }
    throw error;
  }
  return response.json();
};

/**
 * Lista todas as viagens do usuário
 * @returns {Promise<Array>} Array de viagens
 * @throws {Error} Se a requisição falhar
 */
const listarViagens = async () => {
  const token = getToken();
  const response = await fetch('https://api.viajantepro.com.br/viagens', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return handleResponse(response);
};

// Alias para compatibilidade
const getViagens = listarViagens;

/**
 * Cria uma nova viagem
 * @param {Object} viagem - Dados da viagem a ser criada
 * @returns {Promise<Object>} Viagem criada
 * @throws {Error} Se a requisição falhar
 */
const criarViagem = async (viagem) => {
  const token = getToken();
  const response = await fetch('https://api.viajantepro.com.br/viagens', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(viagem)
  });
  return handleResponse(response);
};

/**
 * Edita uma viagem existente
 * @param {string} id - ID da viagem a ser editada
 * @param {Object} viagem - Novos dados da viagem
 * @returns {Promise<Object>} Viagem atualizada
 * @throws {Error} Se a requisição falhar
 */
const editarViagem = async (id, viagem) => {
  const token = getToken();
  const response = await fetch(`https://api.viajantepro.com.br/viagens/${id}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(viagem)
  });
  return handleResponse(response);
};

/**
 * Exclui uma viagem
 * @param {string} id - ID da viagem a ser excluída
 * @returns {Promise<Object>} Resposta da exclusão
 * @throws {Error} Se a requisição falhar
 */
const excluirViagem = async (id) => {
  const token = getToken();
  const response = await fetch(`https://api.viajantepro.com.br/viagens/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return handleResponse(response);
};

/**
 * Lista todos os chats do usuário
 * @returns {Promise<Array>} Array de chats
 * @throws {Error} Se a requisição falhar
 */
const listarChat = async () => {
  const token = getToken();
  const response = await fetch('https://api.viajantepro.com.br/chats', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return handleResponse(response);
};

// Alias para compatibilidade
const getChats = listarChat;

/**
 * Envia uma nova mensagem de chat
 * @param {Object} chat - Dados do chat a ser enviado
 * @returns {Promise<Object>} Chat enviado
 * @throws {Error} Se a requisição falhar
 */
const enviarChat = async (chat) => {
  const token = getToken();
  const response = await fetch('https://api.viajantepro.com.br/chats', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(chat)
  });
  return handleResponse(response);
};

/**
 * Obtém uma viagem pública (não requer autenticação)
 * @param {string} id - ID da viagem pública
 * @returns {Promise<Object>} Viagem pública
 * @throws {Error} Se a requisição falhar
 * @note Esta rota é pública e não requer token de autenticação
 */
const obterViagemPublica = async (id) => {
  const response = await fetch(`https://api.viajantepro.com.br/viagens/publica/${id}`);
  return handleResponse(response);
};

/**
 * Lista todas as conversas do usuário
 * @returns {Promise<Array>} Array de conversas
 * @throws {Error} Se a requisição falhar
 */
const listarConversas = async () => {
  const token = getToken();
  const response = await fetch('https://api.viajantepro.com.br/conversas', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return handleResponse(response);
};

/**
 * Salva conteúdo do site
 * @param {Object} conteudo - Conteúdo a ser salvo
 * @returns {Promise<Object>} Conteúdo salvo
 * @throws {Error} Se a requisição falhar
 */
const salvarConteudo = async (conteudo) => {
  const token = getToken();
  const response = await fetch('/.netlify/functions/viajante-pro/site-salvar', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(conteudo)
  });
  return handleResponse(response);
};

/**
 * Lê conteúdo do site
 * @returns {Promise<Object|null>} Conteúdo do site ou null se não encontrado
 * @throws {Error} Se a requisição falhar (exceto para 404 que retorna null)
 */
const lerConteudo = async () => {
  const token = getToken();
  const response = await fetch('/.netlify/functions/viajante-pro/site-ler', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    return handleResponse(response);
  }
  return response.json();
};

module.exports = { 
  VIAJANTE_PRO, 
  // Funções principais
  listarViagens, 
  criarViagem, 
  editarViagem, 
  excluirViagem, 
  listarChat, 
  enviarChat, 
  obterViagemPublica, 
  listarConversas, 
  salvarConteudo, 
  lerConteudo,
  // Aliases para compatibilidade
  getViagens: listarViagens,
  getChats: listarChat
};
