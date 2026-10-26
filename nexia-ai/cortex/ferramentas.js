'use strict';
// Ferramentas do Cortex (Pilar 3: IA que faz)
// Laço de agente: até 6 passos, prazo total 25s, cada ferramenta 6s

const { buscarWeb } = require('../modos');

// Bloquear IPs internos, localhost e file:
const isInternalUrl = (url) => {
  if (!url) return true;
  try {
    const u = new URL(url);
    return u.hostname === 'localhost' || 
           u.hostname === '127.0.0.1' || 
           u.protocol === 'file:' ||
           u.hostname.includes('.internal') ||
           u.hostname.includes('.local');
  } catch {
    return true;
  }
};

// Parser seguro para cálculos (sem eval)
const parseExpression = (expr) => {
  if (!expr) return null;
  
  // Remove espaços e valida caracteres permitidos
  const clean = expr.replace(/[^0-9\s\+\-\*\/\^\(\)\%]/g, '');
  if (!clean) return null;
  
  try {
    // Função segura para cálculos básicos
    const calculate = (e) => {
      // Substitui ^ por ** para potência
      const processed = e.replace(/\^/g, '**');
      // Usa Function em vez de eval para escopo limitado
      return new Function('return ' + processed)();
    };
    
    const result = calculate(clean);
    return isNaN(result) ? null : result;
  } catch {
    return null;
  }
};

/**
 * Buscar web (DuckDuckGo + Wikipédia + Google Notícias)
 * @param {string} q - Termo de busca
 * @returns {Promise<string>} - Resultados formatados
 */
async function buscar_web(q) {
  return await buscarWeb(q);
}

/**
 * Abrir página e extrair conteúdo
 * @param {string} url - URL da página
 * @returns {Promise<string>} - Conteúdo HTML (máx 8000 caracteres)
 */
async function abrir_pagina(url) {
  if (isInternalUrl(url)) {
    return 'Erro: Não é possível acessar URLs internas ou locais.';
  }
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 
        'User-Agent': 'nexia-cortex',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      return `Erro ao acessar página: ${response.status} ${response.statusText}`;
    }
    
    const html = await response.text();
    // Extrai texto do HTML, removendo tags
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Limita a 8000 caracteres
    return text.length > 8000 ? text.substring(0, 8000) + '...' : text;
  } catch (error) {
    return `Erro ao acessar página: ${error.message}`;
  }
}

/**
 * Calcular expressão matemática
 * @param {string} expressao - Expressão matemática
 * @returns {Promise<string>} - Resultado ou erro
 */
async function calcular(expressao) {
  const result = parseExpression(expressao);
  
  if (result === null) {
    return 'Erro: Expressão inválida ou não suportada.';
  }
  
  return `Resultado: ${result}`;
}

/**
 * Cotação de moedas (AwesomeAPI)
 * @param {string} moeda - Código da moeda (ex: USD, EUR)
 * @returns {Promise<string>} - Cotação formatada
 */
async function cotacao(moeda) {
  if (!moeda) return 'Erro: Moeda não especificada.';
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    
    const response = await fetch(`https://economia.awesomeapi.com.br/json/last/${moeda}-BRL`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'nexia-cortex' }
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      return `Erro ao buscar cotação: ${response.status}`;
    }
    
    const data = await response.json();
    const code = Object.keys(data)[0];
    const info = data[code];
    
    if (!info) {
      return `Cotação não encontrada para ${moeda}.`;
    }
    
    return `Cotação ${moeda}/BRL: R$ ${info.ask} (variação: ${info.varBid}%) - Atualizado em ${info.create_date}`;
  } catch (error) {
    return `Erro ao buscar cotação: ${error.message}`;
  }
}

/**
 * Clima de uma cidade (Open-Meteo)
 * @param {string} cidade - Nome da cidade
 * @returns {Promise<string>} - Previsão do tempo
 */
async function clima(cidade) {
  if (!cidade) return 'Erro: Cidade não especificada.';
  
  try {
    // Primeiro, obter coordenadas da cidade
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    
    const geoResponse = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cidade)}&count=1&language=pt`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'nexia-cortex' }
    });
    
    clearTimeout(timeout);
    
    if (!geoResponse.ok) {
      return `Erro ao buscar localização: ${geoResponse.status}`;
    }
    
    const geoData = await geoResponse.json();
    
    if (!geoData.results || !geoData.results.length) {
      return `Localização não encontrada para ${cidade}.`;
    }
    
    const { latitude, longitude, name, country } = geoData.results[0];
    
    // Agora buscar o clima
    const weatherController = new AbortController();
    const weatherTimeout = setTimeout(() => weatherController.abort(), 3000);
    
    const weatherResponse = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&hourly=temperature_2m,weathercode&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto`, {
      signal: weatherController.signal,
      headers: { 'User-Agent': 'nexia-cortex' }
    });
    
    clearTimeout(weatherTimeout);
    
    if (!weatherResponse.ok) {
      return `Erro ao buscar clima: ${weatherResponse.status}`;
    }
    
    const weatherData = await weatherResponse.json();
    const current = weatherData.current_weather;
    
    if (!current) {
      return `Dados climáticos não disponíveis para ${name}.`;
    }
    
    const temp = current.temperature;
    const weatherCode = current.weathercode;
    
    // Mapeia códigos do tempo para descrição
    const weatherDescriptions = {
      0: 'Céu limpo',
      1: 'Principalmente limpo',
      2: 'Parcialmente nublado',
      3: 'Nublado',
      45: 'Neblina',
      48: 'Neblina',
      51: 'Garoa leve',
      53: 'Garoa moderada',
      55: 'Garoa densa',
      56: 'Aguaceiro leve com neve',
      57: 'Aguaceiro com neve',
      61: 'Chuva leve',
      63: 'Chuva moderada',
      65: 'Chuva forte',
      66: 'Chuva com neve leve',
      67: 'Chuva com neve forte',
      71: 'Neve leve',
      73: 'Neve moderada',
      75: 'Neve forte',
      77: 'Grãos de neve',
      80: 'Aguaceiro leve',
      81: 'Aguaceiro moderado',
      82: 'Aguaceiro forte',
      85: 'Neve leve com aguaceiro',
      86: 'Neve forte com aguaceiro',
      95: 'Trovoada',
      96: 'Trovoada com granizo leve',
      99: 'Trovoada com granizo forte'
    };
    
    const weatherDesc = weatherDescriptions[weatherCode] || 'Condições desconhecidas';
    
    return `Clima em ${name}, ${country}: ${temp}°C - ${weatherDesc}`;
  } catch (error) {
    return `Erro ao buscar clima: ${error.message}`;
  }
}

/**
 * Data e hora atual de Brasília
 * @returns {string} - Data e hora formatadas
 */
function data_hora() {
  const now = new Date();
  const options = {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  };
  
  return now.toLocaleString('pt-BR', options);
}

module.exports = {
  buscar_web,
  abrir_pagina,
  calcular,
  cotacao,
  clima,
  data_hora
};
