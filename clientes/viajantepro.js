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

// Função para obter o token armazenado
const getToken = () => {
  return localStorage.getItem('token');
};

// Função para listar viagens
const listarViagens = async () => {
  const token = getToken();
  const response = await fetch('https://api.viajantepro.com.br/viagens', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
};

// Função para criar uma viagem
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
  return response.json();
};

// Função para editar uma viagem
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
  return response.json();
};

// Função para excluir uma viagem
const excluirViagem = async (id) => {
  const token = getToken();
  const response = await fetch(`https://api.viajantepro.com.br/viagens/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
};

// Função para listar chats
const listarChat = async () => {
  const token = getToken();
  const response = await fetch('https://api.viajantepro.com.br/chats', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
};

// Função para enviar um chat
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
  return response.json();
};

// Função para obter viagem pública
const obterViagemPublica = async (id) => {
  const response = await fetch(`https://api.viajantepro.com.br/viagens/publica/${id}`);
  return response.json();
};

// Função para listar conversas
const listarConversas = async () => {
  const token = getToken();
  const response = await fetch('https://api.viajantepro.com.br/conversas', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
};

// Função para salvar conteúdo do site
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
  return response.json();
};

// Função para ler conteúdo do site
const lerConteudo = async () => {
  const token = getToken();
  const response = await fetch('/.netlify/functions/viajante-pro/site-ler', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (!response.ok) {
    return null;
  }
  return response.json();
};

module.exports = { VIAJANTE_PRO, listarViagens, criarViagem, editarViagem, excluirViagem, listarChat, enviarChat, obterViagemPublica, listarConversas, salvarConteudo, lerConteudo };
