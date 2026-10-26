/**
 * Ferramentas para o NEXIA AI Cortex
 * Exportadas no formato compatível com OpenAI tool calling
 */

// Importações necessárias
const fetch = require('node-fetch');
const { JSDOM } = require('jsdom');

// ---------- Rate limiting e cache (proteção contra abuso) ----------

const RATE_LIMIT_MAX = 10;      // requisições por janela
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minuto
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

const rateMap = new Map(); // chave -> { contagem, inicio }
const cacheMap = new Map(); // chave -> { valor, expira }

function agoraMs() {
  return Date.now();
}

function verificarRateLimit(chave) {
  const agora = agoraMs();
  const registro = rateMap.get(chave);
  if (!registro || agora - registro.inicio > RATE_LIMIT_WINDOW_MS) {
    rateMap.set(chave, { contagem: 1, inicio: agora });
    return true;
  }
  if (registro.contagem >= RATE_LIMIT_MAX) {
    return false;
  }
  registro.contagem++;
  return true;
}

function lerCache(chave) {
  const entrada = cacheMap.get(chave);
  if (!entrada) return null;
  if (agoraMs() > entrada.expira) {
    cacheMap.delete(chave);
    return null;
  }
  return entrada.valor;
}

function gravarCache(chave, valor) {
  cacheMap.set(chave, { valor, expira: agoraMs() + CACHE_TTL_MS });
}

// ---------- Logging estruturado (sem expor segredos) ----------

function log(evento, dados = {}) {
  const linha = {
    ts: new Date().toISOString(),
    evento,
    ...dados
  };
  console.log(JSON.stringify(linha));
}

// ---------- Timeout para requisições HTTP ----------

function fetchComTimeout(url, opts, ms = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  const fetchOpts = { ...opts, signal: controller.signal };
  return fetch(url, fetchOpts).then((res) => {
    clearTimeout(timer);
    return res;
  }).catch((err) => {
    clearTimeout(timer);
    throw err;
  });
}

// ---------- User-Agent com identificação do produto ----------

const USER_AGENT = 'NEXIA-Cortex/1.0 (+https://nexia.ai)';

// ---------- Busca na web (reutiliza busca de modos.js + RSS Google Notícias) ----------

/**
 * Busca na web usando DuckDuckGo e RSS Google Notícias
 * @param {string} q - Termo de busca
 * @returns {Promise<Object>} - Resultados da busca
 */
async function buscar_web(q) {
  const chave = `buscar_web:${q}`;
  if (!verificarRateLimit(chave)) {
    return { error: true, message: 'Limite de requisições excedido. Tente novamente mais tarde.' };
  }
  const cache = lerCache(chave);
  if (cache) return cache;
  try {
    const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1`;
    const response = await fetchComTimeout(searchUrl, { headers: { 'User-Agent': USER_AGENT } });
    const data = await response.json();
    
    const newsUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=pt-BR&gl=BR&ceid=BR:pt`;
    const newsResponse = await fetchComTimeout(newsUrl, { headers: { 'User-Agent': USER_AGENT } });
    const newsText = await newsResponse.text();
    
    const resultado = {
      search: {
        query: q,
        results: data.Abstract ? [data] : [],
        timestamp: new Date().toISOString()
      },
      news: {
        rss: newsText,
        timestamp: new Date().toISOString()
      }
    };
    gravarCache(chave, resultado);
    log('buscar_web.ok', { query: q });
    return resultado;
  } catch (error) {
    log('buscar_web.erro', { query: q, mensagem: 'Falha ao buscar na web' });
    return {
      error: true,
      message: 'Falha ao buscar na web'
    };
  }
}

// ---------- Abrir página (fetch, remove HTML, limite 8000 chars, bloqueia localhost/file/IP interno) ----------

/**
 * Abre uma página web e extrai texto (removendo HTML)
 * @param {string} url - URL da página
 * @returns {Promise<Object>} - Conteúdo da página
 */
async function abrir_pagina(url) {
  const chave = `abrir_pagina:${url}`;
  if (!verificarRateLimit(chave)) {
    return { error: true, message: 'Limite de requisições excedido. Tente novamente mais tarde.' };
  }
  const cache = lerCache(chave);
  if (cache) return cache;
  try {
    let urlObj;
    try {
      urlObj = new URL(url);
    } catch (_) {
      return { error: true, message: 'URL inválida' };
    }
    
    const protocolo = urlObj.protocol;
    const host = urlObj.hostname.toLowerCase();
    
    // Bloqueia protocolos perigosos
    if (protocolo !== 'http:' && protocolo !== 'https:') {
      return { error: true, message: 'Protocolo não permitido' };
    }
    
    // Bloqueia localhost e IPs internos (RFC 1918 + loopback + link-local)
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.startsWith('127.') ||
      host.startsWith('192.168.') ||
      host.startsWith('10.') ||
      host.startsWith('172.16.') ||
      host.startsWith('172.17.') ||
      host.startsWith('172.18.') ||
      host.startsWith('172.19.') ||
      host.startsWith('172.20.') ||
      host.startsWith('172.21.') ||
      host.startsWith('172.22.') ||
      host.startsWith('172.23.') ||
      host.startsWith('172.24.') ||
      host.startsWith('172.25.') ||
      host.startsWith('172.26.') ||
      host.startsWith('172.27.') ||
      host.startsWith('172.28.') ||
      host.startsWith('172.29.') ||
      host.startsWith('172.30.') ||
      host.startsWith('172.31.') ||
      host.endsWith('.local') ||
      host.endsWith('.invalid')
    ) {
      return { error: true, message: 'Falha ao acessar página' };
    }
    
    const response = await fetchComTimeout(url, {
      headers: { 'User-Agent': USER_AGENT }
    });
    
    if (!response.ok) {
      return { error: true, message: 'Falha ao acessar página' };
    }
    
    const html = await response.text();
    const dom = new JSDOM(html);
    const text = dom.window.document.body.textContent || '';
    
    // Limita a 8000 caracteres
    const content = text.substring(0, 8000);
    
    const resultado = {
      url: url,
      content: content,
      length: content.length,
      timestamp: new Date().toISOString()
    };
    gravarCache(chave, resultado);
    log('abrir_pagina.ok', { url, length: content.length });
    return resultado;
  } catch (_) {
    log('abrir_pagina.erro', { url, mensagem: 'Falha ao acessar página' });
    return {
      error: true,
      message: 'Falha ao acessar página'
    };
  }
}

// ---------- Calcular expressão matemática (parser seguro) ----------

/**
 * Calcula expressão matemática básica (apenas números, + - * / ^ % e parênteses)
 * @param {string} expressao - Expressão matemática
 * @returns {Object} - Resultado do cálculo
 */
function calcular(expressao) {
  try {
    if (typeof expressao !== 'string' || expressao.trim().length === 0) {
      throw new Error('Expressão inválida');
    }
    // Remove caracteres perigosos - permitindo apenas números, operadores básicos e parênteses
    const cleaned = expressao.replace(/[^0-9+\-*/^%().\s]/g, '');
    
    // Valida expressão - deve começar com número ou parêntese e conter apenas operadores válidos
    if (!/^[\d(]+(?:[+\-*/^%](?:\d+|\([^)]+\)))*$/.test(cleaned) ||
        /[\^%]{2,}/.test(cleaned)) {
      throw new Error('Expressão inválida');
    }
    
    // Substitui ^ por ** para potência (JS)
    const jsExpr = cleaned.replace(/\^/g, '**');
    
    // Avalia expressão de forma controlada
    const result = Function('"use strict"; return (' + jsExpr + ')')();
    
    if (!Number.isFinite(result)) {
      throw new Error('Resultado não é um número válido');
    }
    
    return {
      expression: expressao,
      result: result,
      timestamp: new Date().toISOString()
    };
  } catch (_) {
    log('calcular.erro', { expressao, mensagem: 'Falha no cálculo' });
    return {
      error: true,
      message: 'Falha no cálculo'
    };
  }
}

// ---------- Cotação de moeda (AwesomeAPI) ----------

const MOEDAS_VALIDAS = new Set([
  'USD', 'EUR', 'GBP', 'BTC', 'ARS', 'CAD', 'AUD', 'JPY', 'CHF', 'CNY',
  'BRL', 'ETH', 'LTC', 'XRP', 'DOGE', 'SOL', 'ADA', 'DOT', 'AVAX', 'MATIC'
]);

function ehMoedaValida(moeda) {
  return typeof moeda === 'string' && MOEDAS_VALIDAS.has(moeda.toUpperCase());
}

/**
 * Busca cotação de moeda usando AwesomeAPI
 * @param {string} moeda - Código da moeda (ex: USD, EUR)
 * @returns {Promise<Object>} - Dados da cotação
 */
async function cotacao(moeda) {
  const chave = `cotacao:${moeda}`;
  if (!verificarRateLimit(chave)) {
    return { error: true, message: 'Limite de requisições excedido. Tente novamente mais tarde.' };
  }
  const cache = lerCache(chave);
  if (cache) return cache;
  try {
    if (!ehMoedaValida(moeda)) {
      return { error: true, message: 'Código de moeda inválido', currency: moeda };
    }
    const codigo = moeda.toUpperCase();
    const url = `https://economia.awesomeapi.com.br/last/${codigo}-BRL`;
    const response = await fetchComTimeout(url, { headers: { 'User-Agent': USER_AGENT } });
    const data = await response.json();
    
    const key = `${codigo}BRL`;
    if (data[key]) {
      const resultado = {
        currency: codigo,
        code: data[key].code,
        codein: data[key].codein,
        name: data[key].name,
        high: data[key].high,
        low: data[key].low,
        varBid: data[key].varBid,
        pctChange: data[key].pctChange,
        timestamp: data[key].createDate,
        fetchedAt: new Date().toISOString()
      };
      gravarCache(chave, resultado);
      log('cotacao.ok', { moeda: codigo });
      return resultado;
    } else {
      return { error: true, message: 'Moeda não encontrada', currency: codigo };
    }
  } catch (_) {
    log('cotacao.erro', { moeda, mensagem: 'Falha ao buscar cotação' });
    return {
      error: true,
      message: 'Falha ao buscar cotação',
      currency: moeda
    };
  }
}

// ---------- Clima (Open-Meteo geocoding + forecast) ----------

/**
 * Busca clima usando Open-Meteo
 * @param {string} cidade - Nome da cidade
 * @returns {Promise<Object>} - Dados do clima
 */
async function clima(cidade) {
  const chave = `clima:${cidade}`;
  if (!verificarRateLimit(chave)) {
    return { error: true, message: 'Limite de requisições excedido. Tente novamente mais tarde.' };
  }
  const cache = lerCache(chave);
  if (cache) return cache;
  try {
    if (typeof cidade !== 'string' || cidade.trim().length === 0) {
      return { error: true, message: 'Nome da cidade inválido', city: cidade };
    }
    // Geocoding para obter coordenadas
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cidade)}&count=1&language=pt&format=json`;
    const geoResponse = await fetchComTimeout(geoUrl, { headers: { 'User-Agent': USER_AGENT } });
    const geoData = await geoResponse.json();
    
    if (!geoData.results || geoData.results.length === 0) {
      return { error: true, message: 'Cidade não encontrada', city: cidade };
    }
    
    const location = geoData.results[0];
    const { latitude, longitude } = location;
    
    // Previsão do tempo
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&forecast_days=1`;
    const weatherResponse = await fetchComTimeout(weatherUrl, { headers: { 'User-Agent': USER_AGENT } });
    const weatherData = await weatherResponse.json();
    
    const current = weatherData.current;
    const daily = weatherData.daily;
    
    const resultado = {
      location: {
        name: location.name,
        country: location.country,
        latitude: latitude,
        longitude: longitude,
        elevation: location.elevation
      },
      current: {
        temperature: current.temperature_2m,
        humidity: current.relative_humidity_2m,
        windSpeed: current.wind_speed_10m,
        weatherCode: current.weather_code,
        timestamp: current.time
      },
      daily: {
        date: daily.time[0],
        maxTemp: daily.temperature_2m_max[0],
        minTemp: daily.temperature_2m_min[0],
        precipitation: daily.precipitation_sum[0]
      },
      fetchedAt: new Date().toISOString()
    };
    gravarCache(chave, resultado);
    log('clima.ok', { cidade });
    return resultado;
  } catch (_) {
    log('clima.erro', { cidade, mensagem: 'Falha ao buscar clima' });
    return {
      error: true,
      message: 'Falha ao buscar clima',
      city: cidade
    };
  }
}

// ---------- Data e hora (Brasília) ----------

/**
 * Retorna data e hora atuais de Brasília
 * @returns {Object} - Data e hora formatadas
 */
function data_hora() {
  try {
    const now = new Date();
    // Usa Intl para horário de Brasília (America/Sao_Paulo)
    const brasiliaTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    
    return {
      datetime: brasiliaTime.toISOString(),
      date: brasiliaTime.toISOString().split('T')[0],
      time: brasiliaTime.toTimeString().split(' ')[0],
      timezone: 'America/Sao_Paulo',
      timestamp: brasiliaTime.getTime(),
      formatted: {
        date: brasiliaTime.toLocaleDateString('pt-BR'),
        time: brasiliaTime.toLocaleTimeString('pt-BR'),
        full: brasiliaTime.toLocaleString('pt-BR')
      }
    };
  } catch (_) {
    log('data_hora.erro', { mensagem: 'Falha ao obter data/hora' });
    return {
      error: true,
      message: 'Falha ao obter data/hora'
    };
  }
}

// ---------- Objeto de ferramentas compatível com OpenAI tool calling ----------

const tools = {
  buscar_web: {
    type: 'function',
    function: {
      name: 'buscar_web',
      description: 'Busca informações na web usando DuckDuckGo e RSS Google Notícias',
      parameters: {
        type: 'object',
        properties: {
          q: {
            type: 'string',
            description: 'Termo de busca'
          }
        },
        required: ['q']
      }
    }
  },
  abrir_pagina: {
    type: 'function',
    function: {
      name: 'abrir_pagina',
      description: 'Abre uma página web e extrai texto (removendo HTML)',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'URL da página para abrir'
          }
        },
        required: ['url']
      }
    }
  },
  calcular: {
    type: 'function',
    function: {
      name: 'calcular',
      description: 'Calcula expressão matemática básica',
      parameters: {
        type: 'object',
        properties: {
          expressao: {
            type: 'string',
            description: 'Expressão matemática (ex: 2 + 2 * 3)'
          }
        },
        required: ['expressao']
      }
    }
  },
  cotacao: {
    type: 'function',
    function: {
      name: 'cotacao',
      description: 'Busca cotação de moeda usando AwesomeAPI',
      parameters: {
        type: 'object',
        properties: {
          moeda: {
            type: 'string',
            description: 'Código da moeda (ex: USD, EUR)'
          }
        },
        required: ['moeda']
      }
    }
  },
  clima: {
    type: 'function',
    function: {
      name: 'clima',
      description: 'Busca informações climáticas usando Open-Meteo',
      parameters: {
        type: 'object',
        properties: {
          cidade: {
            type: 'string',
            description: 'Nome da cidade'
          }
        },
        required: ['cidade']
      }
    }
  },
  data_hora: {
    type: 'function',
    function: {
      name: 'data_hora',
      description: 'Retorna data e hora atuais de Brasília',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  }
};

module.exports = {
  buscar_web,
  abrir_pagina,
  calcular,
  cotacao,
  clima,
  data_hora,
  tools
};
