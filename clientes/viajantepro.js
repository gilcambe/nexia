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

// Obtém o token armazenado no localStorage
function getToken() {
  return localStorage.getItem('viajantepro_token');
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
      token,
      ...data
    })
  });
  
  if (!response.ok) {
    throw new Error(`Erro na API: ${response.status}`);
  }
  
  return response.json();
}

// Funções de Viagem

/**
 * Lista todas as viagens
 * @returns {Promise<Array>} Array de viagens
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
 */
async function criarViagem(viagem) {
  const result = await apiRequest('viagem-criar', viagem);
  return result;
}

/**
 * Edita uma viagem existente
 * @param {string} id - ID da viagem
 * @param {Object} viagem - Dados atualizados da viagem
 * @returns {Promise<Object>} Viagem atualizada
 */
async function editarViagem(id, viagem) {
  const result = await apiRequest('viagem-editar', { id, ...viagem });
  return result.viagem;
}

/**
 * Exclui uma viagem
 * @param {string} id - ID da viagem
 * @returns {Promise<Object>} Confirmação de exclusão
 */
async function excluirViagem(id) {
  const result = await apiRequest('viagem-excluir', { id });
  return result;
}

// Funções de Chat

/**
 * Lista as mensagens de um chat específico
 * @param {string} viagemId - ID da viagem
 * @param {string} desde - ID da última mensagem (opcional)
 * @returns {Promise<Object>} Mensagens do chat
 */
async function getChats(viagemId, desde) {
  const data = { v: viagemId };
  if (desde) {
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
 */
async function enviarChat(viagemId, texto, autor = 'viajante') {
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
  enviarChat
};
