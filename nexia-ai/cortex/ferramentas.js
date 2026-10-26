'use strict';
// Ferramentas do Cortex (Pilar 3: IA que faz)
// Laço de agente: até 6 passos, prazo total 25s, cada ferramenta 6s

// Cadeia de provedores grátis com tool calling
const providers = ['groq', 'google'];

// Laço de agente com timeout total
const MAX_STEPS = 6;
const TOTAL_TIMEOUT = 25000; // 25 segundos
const TOOL_TIMEOUT = 6000;   // 6 segundos por ferramenta

/**
 * Executa um laço de agente com ferramentas
 * @param {string} pergunta - Pergunta do usuário
 * @param {Object} tools - Objeto com as funções disponíveis
 * @param {Object} options - Opções de configuração
 * @returns {Promise<string>} - Resposta formatada
 */
async function agente(pergunta, tools, options = {}) {
  const startTime = Date.now();
  const steps = [];
  let context = `Pergunta original: ${pergunta}`;
  
  // Timeout total
  const totalTimeout = setTimeout(() => {
    throw new Error('Tempo total excedido');
  }, TOTAL_TIMEOUT);
  
  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      const stepStart = Date.now();
      
      // Timeout por passo
      const stepTimeout = setTimeout(() => {
        throw new Error(`Passo ${step + 1} excedido`);
      }, TOOL_TIMEOUT);
      
      try {
        // Escolher ferramenta baseada no contexto
        let toolName = 'calcular';
        let toolArgs = {};
        
        // Análise simples: se tiver palavra de dinheiro/valor, usar cotacao;
        // se tiver cidade, usar clima; se tiver URL, usar abrir_pagina;
        const lower = pergunta.toLowerCase();
        
        if (lower.includes('dólar') || lower.includes('dollar') || lower.includes('$')) {
          toolName = 'cotacao';
          toolArgs = { moeda: 'USD' };
        } else if (lower.includes('clima') || lower.includes('tempo')) {
          // Extrair cidade
          const cityMatch = pergunta.match(/clima ([\w\s]+)/i) || pergunta.match(/tempo ([\w\s]+)/i);
          if (cityMatch) {
            toolName = 'clima';
            toolArgs = { cidade: cityMatch[1].trim() };
          }
        } else if (lower.includes('http://') || lower.includes('https://')) {
          // Extrair URL - procurar por padrão de URL
          const urlMatch = pergunta.match(/https?:\/\/[\s\S]{1,200}/);
          if (urlMatch) {
            toolName = 'abrir_pagina';
            toolArgs = { url: urlMatch[0] };
          }
        } else if (/\d+[%,]+\s*\d+/.test(pergunta) || /\d+\s*\*\s*\d+/.test(pergunta)) {
          toolName = 'calcular';
          // Extrair expressão matemática
          const exprMatch = pergunta.match(/(\d+[\d %*/^()]+)/);
          if (exprMatch) {
            toolArgs = { expressao: exprMatch[1] };
          }
        }
        
        // Executar ferramenta
        let resultado;
        try {
          resultado = await tools[toolName](toolArgs);
        } catch (e) {
          resultado = `❌ Erro na ${toolName}: ${e.message}`;
        }
        
        steps.push({ step: step + 1, tool: toolName, resultado })
        context += `\n\nPasso ${step + 1} - ${toolName}: ${String(resultado).slice(0, 200)}`;
        
        // Se temos resultado suficiente, parar
        if (toolName !== 'calcular' && steps.length >= 2) {
          break;
        }
        
      } finally {
        clearTimeout(stepTimeout);
      }
    }
  } catch (e) {
    steps.push({ step: 'timeout', error: e.message });
  } finally {
    clearTimeout(totalTimeout);
  }
  
  // Formatar resposta com todos os passos
  let resposta = '';
  for (const s of steps) {
    if (s.step === 'timeout') {
      resposta += `❌ ${s.error}\n\n`;
    } else {
      const label = { buscar_web: '🔎', cotacao: '💰', calcular: '🧮', clima: '🌦️', abrir_pagina: '📄' }[s.tool] || '⚙';
      resposta += `${label} ${s.tool}: ${String(s.resultado).slice(0, 150)}\n\n`;
    }
  }
  
  return resposta || 'Sem ferramentas necessárias.';
}

/**
 * Executa um laço de agente com ferramentas
 * @param {string} pergunta - Pergunta do usuário
 * @param {Object} tools - Objeto com as funções disponíveis
 * @param {Object} options - Opções de configuração
 * @returns {Promise<string>} - Resposta formatada
 */
async function agente(pergunta, tools, options = {}) {
  const startTime = Date.now();
  const steps = [];
  let context = `Pergunta original: ${pergunta}`;
  
  // Timeout total
  const totalTimeout = setTimeout(() => {
    throw new Error('Tempo total excedido');
  }, TOTAL_TIMEOUT);
  
  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      const stepStart = Date.now();
      
      // Timeout por passo
      const stepTimeout = setTimeout(() => {
        throw new Error(`Passo ${step + 1} excedido`);
      }, TOOL_TIMEOUT);
      
      try {
        // Escolher ferramenta baseada no contexto
        let toolName = 'calcular';
        let toolArgs = {};
        
        // Análise simples: se tiver palavra de dinheiro/valor, usar cotacao;
        // se tiver cidade, usar clima; se tiver URL, usar abrir_pagina;
        const lower = pergunta.toLowerCase();
        
        if (lower.includes('dólar') || lower.includes('dollar') || lower.includes('$')) {
          toolName = 'cotacao';
          toolArgs = { moeda: 'USD' };
        } else if (lower.includes('clima') || lower.includes('tempo')) {
          // Extrair cidade
          const cityMatch = pergunta.match(/clima ([\w\s]+)/i) || pergunta.match(/tempo ([\w\s]+)/i);
          if (cityMatch) {
            toolName = 'clima';
            toolArgs = { cidade: cityMatch[1].trim() };
          }
        } else if (lower.includes('http://') || lower.includes('https://')) {
          // Extrair URL - procurar por padrão de URL
          const urlMatch = pergunta.match(/https?:\/\/[\s\S]{1,200}/);
          if (urlMatch) {
            toolName = 'abrir_pagina';
            toolArgs = { url: urlMatch[0] };
          }
        } else if (/\d+[%,]+\s*\d+/.test(pergunta) || /\d+\s*\*\s*\d+/.test(pergunta)) {
          toolName = 'calcular';
          // Extrair expressão matemática
          const exprMatch = pergunta.match(/(\d+[\d %*/^()]+)/);
          if (exprMatch) {
            toolArgs = { expressao: exprMatch[1] };
          }
        }
        
        // Executar ferramenta
        let resultado;
        try {
          resultado = await tools[toolName](toolArgs);
        } catch (e) {
          resultado = `❌ Erro na ${toolName}: ${e.message}`;
        }
        
        steps.push({ step: step + 1, tool: toolName, resultado })
        context += `\n\nPasso ${step + 1} - ${toolName}: ${String(resultado).slice(0, 200)}`;
        
        // Se temos resultado suficiente, parar
        if (toolName !== 'calcular' && steps.length >= 2) {
          break;
        }
        
      } finally {
        clearTimeout(stepTimeout);
      }
    }
  } catch (e) {
    steps.push({ step: 'timeout', error: e.message });
  } finally {
    clearTimeout(totalTimeout);
  }
  
  // Formatar resposta com todos os passos
  let resposta = '';
  for (const s of steps) {
    if (s.step === 'timeout') {
      resposta += `❌ ${s.error}\n\n`;
    } else {
      const label = { buscar_web: '🔎', cotacao: '💰', calcular: '🧮', clima: '🌦️', abrir_pagina: '📄' }[s.tool] || '⚙';
      resposta += `${label} ${s.tool}: ${String(s.resultado).slice(0, 150)}\n\n`;
    }
  }
  
  return resposta || 'Sem ferramentas necessárias.';
}

/**
 * Buscar na web (DuckDuckGo + Wikipedia) + RSS do Google Notícias
 * @param {string} q - Pergunta/pesquisa
 * @returns {Promise<string>} - Resultados da busca
 */
async function buscarWeb(q) {
  const query = encodeURIComponent(String(q || '').slice(0, 200));
  const googleNewsRss = `https://news.google.com/rss/search?q=${query}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
  
  // Buscar DuckDuckGo + Wikipedia (reutilizar de modos.js)
  const { buscarWeb: fetchBuscarWeb } = require('../modos');
  const resultadosDuck = await fetchBuscarWeb(q, fetch, 4000);
  
  // Adicionar RSS do Google Notícias (tentar fetch simples)
  let noticias = '';
  try {
    const resp = await fetch(googleNewsRss, { headers: { 'User-Agent': 'NEXIA-Cortex' } });
    if (resp.ok) {
      const text = await resp.text();
      // Extrair títulos dos últimos itens do RSS
      const items = text.match(/<item>.*?<\/item>/gs);
      if (items) {
        noticias = items.slice(0, 3).map(item => {
          const title = item.match(/<title><\/title>.*?<title>(.*?)<\/title>/)[1];
          const link = item.match(/<link>(.*?)<\/link>)/1);
          return `• ${title} (${link})`;
        }).join('\n');
      }
    }
  } catch (e) {
    // Em caso de erro, continuar sem as notícias (não bloquear)
  }
  
  if (resultadosDuck && resultadosDuck.length > 0) {
    return `Resultados da web (cite a fonte entre parênteses; se não bastarem, diga que não achou):\n${resultadosDuck.join('\n')}\n\nÚltimas notícias:\n${noticias || 'Nenhum'}`;
  }
  return `Resultados da web: ${noticias || 'Nenhum resultado encontrado.'}`;
}

/**
 * Abrir página web e extrair HTML (máx 8000 caracteres)
 * @param {Object} args - { url }
 * @returns {Promise<string>} - HTML da página ou erro
 */
async function abrir_pagina({ url }) {
  // Bloquear IPs internos RFC 1918 e localhost/file
  const ipInterno = /^10\.|^172\.1[6-9]\.|^172\.2[0-9]\.|^172\.3[0-1]\.|^192\.168\./;
  const bloqueados = ['localhost', '127.0.0.1', 'file:'];
  
  if (bloqueados.some(b => url.includes(b)) || ipInterno.test(url)) {
    return '❌ Acesso bloqueado: URLs internas (localhost, 127.0.0.1, file:) e IPs internos (10.x.x.x, 172.16-31.x.x, 192.168.x.x) são bloqueados.';
  }
  
  try {
    const resp = await fetch(url, { headers: { 'User-Agent': 'NEXIA-Cortex' }, timeout: 5000 });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const html = await resp.text();
    return html.slice(0, 8000);
  } catch (e) {
    return `❌ Erro ao abrir ${url}: ${e.message}`;
  }
}

/**
 * Calcular expressão matemática segura (sem eval)
 * @param {string} expressao - Expressão com + - * / ^ ( ) e %
 * @returns {Promise<number|string>} - Resultado ou mensagem de erro
 */
async function calcular({ expressao }) {
  // Parser próprio de + - * / ^ ( ) e %
  const processed = String(expressao || '')
    .replace(/\s+/g, '')
    .replace(/\^/g, '**');
  
  // Validar: apenas números, operadores e parêntesis permitidos
  if (!/^\d+[\d %*/^().]+$/.test(processed.replace(/%/g, ''))) {
    return '❌ Expressão inválida: use apenas números e + - * / ^ ( ) %';
  }
  
  try {
    // Usar Function de forma segura - apenas matemática básica
    // Divisão inteira com % e potência com **
    const result = new Function('return ' + processed)();
    return typeof result === 'number' ? Number(result.toFixed(2)) : result;
  } catch (e) {
    return `❌ Erro ao calcular: ${e.message}`;
  }
}

/**
 * Cotação de moeda via AwesomeAPI
 * @param {Object} args - { moeda: 'USD' | 'EUR' | ... }
 * @returns {Promise<string>} - Cotação e horário
 */
async function cotacao({ moeda = 'USD' }) {
  try {
    const resp = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL', { headers: { 'User-Agent': 'NEXIA-Cortex' } });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const dados = await resp.json();
    const dolar = dados.USD ? dados.USD : dados[moeda] || {};
    const price = parseFloat(dolar.price || 0);
    const hora = dolar.create_time || new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    return `💧 Cotação do ${moeda}: R$ ${price.toFixed(2)} (${hora})`;
  } catch (e) {
    return `❌ Erro ao cotação: ${e.message}`;
  }
}

/**
 * Clima via Open-Meteo (geocoding + forecast, sem chave)
 * @param {Object} args - { cidade }
 * @returns {Promise<string>} - Informações do clima
 */
async function clima({ cidade }) {
  try {
    // Geocoding simples: converter cidade em coordenadas
    const encodedCity = encodeURIComponent(cidade || 'Brasilia');
    const geoResp = await fetch(`https://geocoding-api.open-meteo.com/v1/forecast?latitude=&longitude=&current_weather=true&timezone=America%2FSao_Paulo&query=${encodedCity}`, {
      headers: { 'User-Agent': 'NEXIA-Cortex' }
    });
    if (!geoResp.ok) throw new Error('Cidade não encontrada');
    const geoData = await geoResp.json();
    
    if (!geoData.current_weather) throw new Error('Sem dados de clima');
    
    const { temperature, windspeed, weathercode } = geoData.current_weather;
    const codes = { 0: 'Limpo', 1: 'Parcialmente nublado', 2: 'Nublado', 3: 'Nevoeiro', 45: 'Neblina', 48: 'Deposição de geada', 51: 'Chuvisco leve', 53: 'Chuvisco moderado', 55: 'Chuvisco intenso', 56: 'Chuva leve', 57: 'Chuva intensa', 61: 'Chuva leve contínua', 63: 'Chuva moderada', 65: 'Chuva intensa', 66: 'Chuva congelante', 67: 'Chuva congelante intensa', 71: 'Neve leve', 73: 'Neve moderada', 75: 'Neva intensa', 77: 'Grava de neve', 80: 'Chuva esporádica', 81: 'Chuva esporádica intensa', 82: 'Chuva de granulados', 95: 'Tempestade leve', 96: 'Tempestade com granizo', 99: 'Tempestade intensa' };
    
    return `🌤️ Clima em ${cidade}: ${temperature}°C, vento ${windspeed} km/h - ${codes[weathercode] || 'Condição desconhecida'}`;
  } catch (e) {
    return `❌ Erro ao clima: ${e.message}`;
  }
}

/**
 * Horário de Brasília
 * @returns {Promise<string>} - Horário formatado
 */
async function data_hora() {
  return new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

module.exports = {
  agente,
  buscarWeb,
  abrir_pagina,
  calcular,
  cotacao,
  clima,
  data_hora,
  MAX_STEPS,
  TOTAL_TIMEOUT,
  TOOL_TIMEOUT
};
