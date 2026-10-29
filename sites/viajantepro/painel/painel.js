const API_URL = '/api/viagem';
let TOKEN = '';

function init() {
  // Inicialização do painel
  TOKEN = localStorage.getItem('viajante_token') || '';
  if (TOKEN) {
    exibirAreaLogada();
    carregarDadosIniciais();
  } else {
    exibirAreaDeslogada();
  }
}

function exibirAreaLogada() {
  document.getElementById('area-deslogada').classList.add('oculto');
  document.getElementById('area-logada').classList.remove('oculto');
  document.getElementById('menu-inferior').classList.remove('oculto');
  document.getElementById('usuario-topo').classList.remove('oculto');
}

function exibirAreaDeslogada() {
  document.getElementById('area-deslogada').classList.remove('oculto');
  document.getElementById('area-logada').classList.add('oculto');
  document.getElementById('menu-inferior').classList.add('oculto');
  document.getElementById('usuario-topo').classList.add('oculto');
}

async function apiRequest(endpoint, method = 'GET', data = null) {
  const headers = {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json'
  };
  const options = {
    method,
    headers
  };
  if (data) {
    options.body = JSON.stringify(data);
  }
  const response = await fetch(`${API_URL}${endpoint}`, options);
  if (!response.ok) {
    throw new Error(`Erro na requisição: ${response.status}`);
  }
  return response.json();
}

async function carregarDadosIniciais() {
  try {
    const dados = await apiRequest('/dados-iniciais');
    // Processar dados iniciais
  } catch (error) {
    console.error('Erro ao carregar dados iniciais:', error);
  }
}

// Adicione mais funções conforme necessário
