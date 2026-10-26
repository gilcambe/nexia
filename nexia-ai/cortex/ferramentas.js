/**
 * Ferramentas para o NEXIA AI Cortex
 * Exportadas no formato compatível com OpenAI tool calling
 */

// Importações necessárias
const fetch = require('node-fetch');
const { JSDOM } = require('jsdom');

/**
 * Busca na web usando busca de modos.js e RSS Google Notícias
 * @param {string} q - Termo de busca
 * @returns {Promise<Object>} - Resultados da busca
 */
async function buscar_web(q) {
  try {
    // Busca geral (implementação simplificada)
    const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1`;
    const response = await fetch(searchUrl);
    const data = await response.json();
    
    // Busca RSS Google Notícias
    const newsUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=pt-BR&gl=BR&ceid=BR:pt`;
    const newsResponse = await fetch(newsUrl);
    const newsText = await newsResponse.text();
    
    return {
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
  } catch (error) {
    console.error('Erro na busca web:', error);
    return {
      error: true,
      message: 'Falha ao buscar na web',
      details: error.message
    };
  }
}

/**
 * Abre uma página web e extrai texto (removendo HTML)
 * @param {string} url - URL da página
 * @returns {Promise<Object>} - Conteúdo da página
 */
async function abrir_pagina(url) {
  try {
    // Bloqueia URLs perigosas
    if (url.includes('localhost') || url.includes('127.0.0.1') || 
        url.includes('file://') || url.includes('192.168.') || 
        url.includes('10.') || url.includes('172.')) {
      throw new Error('URL bloqueada: acesso local não permitido');
    }
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    const dom = new JSDOM(html);
    const text = dom.window.document.body.textContent || '';
    
    // Limita a 8000 caracteres
    const content = text.substring(0, 8000);
    
    return {
      url: url,
      content: content,
      length: content.length,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Erro ao abrir página:', error);
    return {
      error: true,
      message: 'Falha ao acessar página',
      details: error.message,
      url: url
    };
  }
}

/**
 * Calcula expressão matemática (parser seguro)
 * @param {string} expressao - Expressão matemática
 * @returns {Object} - Resultado do cálculo
 */
function calcular(expressao) {
  try {
    // Remove caracteres perigosos - permitindo apenas números, operadores básicos e parênteses
    const cleaned = expressao.replace(/[^0-9+\-*/^%().\s]/g, '');
    
    // Valida expressão - deve começar com número e conter apenas operadores válidos
    if (!/^\d+(?:[+\-*/^%](?:\d+|\([^)]+\)))*$/.test(cleaned) || 
        /[\^%]{2,}/.test(cleaned)) {
      throw new Error('Expressão inválida: contém caracteres ou operadores não permitidos');
    }
    
    // Avalia expressão (usando Function para eval controlado)
    const result = Function('"use strict"; return (' + cleaned + ')')();
    
    return {
      expression: expressao,
      result: result,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Erro no cálculo:', error);
    return {
      error: true,
      message: 'Falha no cálculo',
      details: error.message,
      expression: expressao
    };
  }
}

/**
 * Busca cotação de moeda usando AwesomeAPI
 * @param {string} moeda - Código da moeda (ex: USD, EUR)
 * @returns {Promise<Object>} - Dados da cotação
 */
async function cotacao(moeda) {
  try {
    const url = `https://economia.awesomeapi.com.br/last/${moeda}-BRL`;
    const response = await fetch(url);
    const data = await response.json();
    
    const key = `${moeda}BRL`;
    if (data[key]) {
      return {
        currency: moeda,
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
    } else {
      throw new Error(`Moeda ${moeda} não encontrada`);
    }
  } catch (error) {
    console.error('Erro na cotação:', error);
    return {
      error: true,
      message: 'Falha ao buscar cotação',
      details: error.message,
      currency: moeda
    };
  }
}

/**
 * Busca clima usando Open-Meteo
 * @param {string} cidade - Nome da cidade
 * @returns {Promise<Object>} - Dados do clima
 */
async function clima(cidade) {
  try {
    // Geocoding para obter coordenadas
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cidade)}&count=1&language=pt&format=json`;
    const geoResponse = await fetch(geoUrl);
    const geoData = await geoResponse.json();
    
    if (!geoData.results || geoData.results.length === 0) {
      throw new Error(`Cidade ${cidade} não encontrada`);
    }
    
    const location = geoData.results[0];
    const { latitude, longitude } = location;
    
    // Previsão do tempo
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&forecast_days=1`;
    const weatherResponse = await fetch(weatherUrl);
    const weatherData = await weatherResponse.json();
    
    const current = weatherData.current;
    const daily = weatherData.daily;
    
    return {
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
  } catch (error) {
    console.error('Erro no clima:', error);
    return {
      error: true,
      message: 'Falha ao buscar clima',
      details: error.message,
      city: cidade
    };
  }
}

/**
 * Retorna data e hora atuais de Brasília
 * @returns {Object} - Data e hora formatadas
 */
function data_hora() {
  try {
    const now = new Date();
    // Converte para horário de Brasília (UTC-3)
    const brasiliaTime = new Date(now.getTime() - (3 * 60 * 60 * 1000));
    
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
  } catch (error) {
    console.error('Erro na data/hora:', error);
    return {
      error: true,
      message: 'Falha ao obter data/hora',
      details: error.message
    };
  }
}

/**
 * Objeto de ferramentas compatível com OpenAI tool calling
 */
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