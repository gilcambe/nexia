'use strict';
// #1694 (pilar 3): ferramentas do chat do Cortex no formato de tool calling da OpenAI. Tudo grátis e sem chave.
// Cada ferramenta recebe { fetchImpl } para rodar no Worker e nos testes; devolve texto curto para o modelo.

const buscaWeb = require('../../lib/busca-web');

const PRAZO_MS = 6000;
const MAX_PAGINA = 8000;

function comPrazo(fetchImpl, ms = PRAZO_MS) {
  return (url, opts = {}) => {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms);
    return Promise.resolve(fetchImpl(url, { ...opts, signal: ctl.signal })).finally(() => clearTimeout(t));
  };
}

/** Bloqueia endereços internos (SSRF): localhost, IPs privados, file:, porta fora do padrão. */
function urlPermitida(texto) {
  let u;
  try { u = new URL(String(texto)); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (u.username || u.password || (u.port && !['80', '443'].includes(u.port))) return null;
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal') || !h.includes('.') && !h.includes(':')) return null;
  if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h)) return null;
  if (h.includes(':') && (h === '::1' || /^(fc|fd|fe80)/.test(h))) return null;
  return u;
}

const semHtml = (html) => String(html)
  .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/\s+/g, ' ').trim();

/** Conta segura, sem eval: + - * / ^ % e parênteses. "17% de 2350" vira 0.17*2350. */
function calcular(expressao) {
  const src = String(expressao || '').replace(/(\d+(?:[.,]\d+)?)\s*%\s*(de|of)\s*/gi, '($1/100)*').replace(/(\d),(\d)/g, '$1.$2').replace(/\s+/g, '');
  if (!src || src.length > 200 || /[^0-9.+\-*/^%()]/.test(src)) return { erro: 'Expressão inválida.' };
  let i = 0;
  const ver = () => src[i];
  function numero() {
    if (ver() === '(') { i++; const v = soma(); if (ver() !== ')') throw new Error('parêntese'); i++; return v; }
    if (ver() === '-') { i++; return -numero(); }
    if (ver() === '+') { i++; return numero(); }
    const m = /^\d+(?:\.\d+)?/.exec(src.slice(i));
    if (!m) throw new Error('número');
    i += m[0].length;
    let v = Number(m[0]);
    if (ver() === '%') { i++; v /= 100; }
    return v;
  }
  function potencia() { const b = numero(); if (ver() === '^') { i++; return b ** potencia(); } return b; }
  function produto() { let v = potencia(); while (ver() === '*' || ver() === '/') { const op = src[i++]; const d = potencia(); v = op === '*' ? v * d : v / d; } return v; }
  function soma() { let v = produto(); while (ver() === '+' || ver() === '-') { const op = src[i++]; const d = produto(); v = op === '+' ? v + d : v - d; } return v; }
  try {
    const v = soma();
    if (i !== src.length || !Number.isFinite(v)) return { erro: 'Expressão inválida.' };
    return { resultado: Math.round(v * 1e10) / 1e10 };
  } catch { return { erro: 'Expressão inválida.' }; }
}

function dataHora(agora = new Date()) {
  return { agora: agora.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }), fuso: 'America/Sao_Paulo' };
}

async function buscarWebFerramenta({ q }, { fetchImpl }) {
  const r = await buscaWeb.buscar(String(q || ''), { fetchImpl, max: 5 });
  return { fontes: r.fontes, contexto: r.contexto };
}

async function abrirPagina({ url }, { fetchImpl }) {
  const u = urlPermitida(url);
  if (!u) return { erro: 'Endereço não permitido.' };
  const r = await comPrazo(fetchImpl)(u.toString(), { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Cortex/1.0)', Accept: 'text/html,text/plain' }, redirect: 'manual' });
  if (r.status >= 300 && r.status < 400) {
    const destino = urlPermitida(new URL(r.headers.get('location') || '', u).toString());
    if (!destino) return { erro: 'Redirecionamento não permitido.' };
    return abrirPagina({ url: destino.toString() }, { fetchImpl });
  }
  if (!r.ok) return { erro: `A página respondeu ${r.status}.` };
  const texto = semHtml(await r.text());
  return { url: u.toString(), texto: texto.slice(0, MAX_PAGINA), cortado: texto.length > MAX_PAGINA };
}

async function cotacao({ moeda = 'USD' }, { fetchImpl }) {
  const m = String(moeda).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
  if (!/^[A-Z]{3}$/.test(m)) return { erro: 'Moeda inválida (use USD, EUR, BTC…).' };
  const r = await comPrazo(fetchImpl)(`https://economia.awesomeapi.com.br/json/last/${m}-BRL`);
  const j = await r.json().catch(() => ({}));
  const c = j[`${m}BRL`];
  if (!c) return { erro: 'Cotação não encontrada.' };
  return { moeda: m, compra: Number(c.bid), venda: Number(c.ask), variacao: Number(c.pctChange), quando: c.create_date, fonte: 'https://economia.awesomeapi.com.br' };
}

async function clima({ cidade }, { fetchImpl }) {
  const f = comPrazo(fetchImpl);
  const g = await (await f(`https://geocoding-api.open-meteo.com/v1/search?count=1&language=pt&name=${encodeURIComponent(String(cidade || '').slice(0, 80))}`)).json().catch(() => ({}));
  const lugar = (g.results || [])[0];
  if (!lugar) return { erro: 'Cidade não encontrada.' };
  const p = await (await f(`https://api.open-meteo.com/v1/forecast?latitude=${lugar.latitude}&longitude=${lugar.longitude}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=America%2FSao_Paulo&forecast_days=3`)).json().catch(() => ({}));
  return { cidade: `${lugar.name}${lugar.admin1 ? ', ' + lugar.admin1 : ''}`, agora: p.current || null, proximos_dias: p.daily || null, fonte: 'https://open-meteo.com' };
}

const FERRAMENTAS = {
  buscar_web: { run: buscarWebFerramenta, description: 'Pesquisa na web agora (notícias, fatos recentes). Devolve fontes com link.', parameters: { q: { type: 'string', description: 'termos da busca' } }, required: ['q'] },
  abrir_pagina: { run: abrirPagina, description: 'Abre um link e devolve o texto da página (até 8.000 letras).', parameters: { url: { type: 'string' } }, required: ['url'] },
  calcular: { run: async (a) => calcular(a.expressao), description: 'Faz contas exatas: + - * / ^ % e parênteses.', parameters: { expressao: { type: 'string' } }, required: ['expressao'] },
  cotacao: { run: cotacao, description: 'Cotação atual de uma moeda em reais (USD, EUR, BTC…).', parameters: { moeda: { type: 'string' } }, required: ['moeda'] },
  clima: { run: clima, description: 'Tempo agora e nos próximos 3 dias numa cidade.', parameters: { cidade: { type: 'string' } }, required: ['cidade'] },
  data_hora: { run: async () => dataHora(), description: 'Data, dia da semana e hora de Brasília.', parameters: {}, required: [] },
};

/** Lista no formato `tools` da OpenAI (Groq e Gemini aceitam igual). */
const tools = Object.entries(FERRAMENTAS).map(([name, f]) => ({
  type: 'function',
  function: { name, description: f.description, parameters: { type: 'object', properties: f.parameters, required: f.required } },
}));

/** Roda uma chamada de ferramenta do modelo. O resultado vai para o modelo como dado, nunca como instrução. */
async function executar(nome, args, { fetchImpl = (...a) => fetch(...a) } = {}) {
  const f = Object.prototype.hasOwnProperty.call(FERRAMENTAS, nome) ? FERRAMENTAS[nome] : null;
  if (!f) return { erro: `Ferramenta desconhecida: ${nome}` };
  let a = args;
  if (typeof a === 'string') { try { a = JSON.parse(a || '{}'); } catch { return { erro: 'Argumentos inválidos.' }; } }
  try { return await f.run(a || {}, { fetchImpl }); } catch (e) { return { erro: e && e.name === 'AbortError' ? 'Demorou demais.' : 'Falhou agora.' }; }
}

/** Embrulha o resultado para o prompt (#1685: conteúdo externo nunca é instrução). */
const comoDado = (nome, resultado) => `<dados_externos ferramenta="${nome}">\n${JSON.stringify(resultado).slice(0, MAX_PAGINA + 500)}\n</dados_externos>`;

module.exports = { tools, executar, comoDado, calcular, urlPermitida, dataHora, FERRAMENTAS };
