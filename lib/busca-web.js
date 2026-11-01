'use strict';
// Busca na web com citação (#826, #1733). Grátis e sem chave: DuckDuckGo (versão HTML), Google News RSS, Bing News RSS,
// GDELT (notícias), Wikipédia em português e cotação de moedas (AwesomeAPI, com open.er-api de reserva). As fontes rodam juntas, cada uma com prazo próprio, e os resultados se somam.
// Devolve até N fontes {titulo, url, trecho} e um bloco de contexto numerado [1], [2]… para a IA citar.

const UA = 'Mozilla/5.0 (compatible; NEXIA-Cortex/1.0; +https://kernex.com.br)';
const decodificar = (s) => String(s || '')
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  .replace(/\s+/g, ' ').trim();

function urlReal(href) {
  let h = decodificar(href);
  if (h.startsWith('//')) h = 'https:' + h;
  try {
    const u = new URL(h);
    if (/duckduckgo\.com$/.test(u.hostname) && u.pathname.startsWith('/l/')) return u.searchParams.get('uddg') || '';
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : '';
  } catch { return ''; }
}

/** Lê a página de resultados HTML do DuckDuckGo. */
function lerDuckDuckGo(html, max = 5) {
  const out = [];
  const re = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>([\s\S]*?)(?=<a[^>]*class="[^"]*result__a|$)/g;
  let m;
  while ((m = re.exec(String(html))) && out.length < max) {
    const url = urlReal(m[1]);
    if (!url || /duckduckgo\.com\/y\.js|ad_provider/.test(url)) continue; // anúncios
    const trecho = (/class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|div|td)>/.exec(m[3]) || [])[1];
    out.push({ titulo: decodificar(m[2]).slice(0, 200), url, trecho: decodificar(trecho).slice(0, 400) });
  }
  return out;
}

async function duckDuckGo(q, { fetchImpl, max }) {
  const r = await fetchImpl('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(q) + '&kl=br-pt', { headers: { 'User-Agent': UA, Accept: 'text/html' } });
  if (!r.ok) return [];
  return lerDuckDuckGo(await r.text(), max);
}

/** Lê feed RSS do Google News. */
function lerGoogleNews(xml, max = 5) {
  const out = [];
  const reItem = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = reItem.exec(String(xml))) && out.length < max) {
    const itemStr = m[1];
    const titM = /<title>([\s\S]*?)<\/title>/.exec(itemStr);
    const linkM = /<link>([\s\S]*?)<\/link>/.exec(itemStr);
    const pubM = /<pubDate>([\s\S]*?)<\/pubDate>/.exec(itemStr);
    if (!titM || !linkM) continue;
    const url = urlReal(linkM[1]) || linkM[1].trim();
    if (!url) continue;
    const pub = pubM ? decodificar(pubM[1]) : '';
    out.push({
      titulo: decodificar(titM[1]).slice(0, 200),
      url,
      trecho: (pub ? `[${pub}] ` : '') + decodificar(titM[1]).slice(0, 300)
    });
  }
  return out;
}

async function googleNews(q, { fetchImpl, max }) {
  const u = 'https://news.google.com/rss/search?q=' + encodeURIComponent(q) + '&hl=pt-BR&gl=BR&ceid=BR:pt-419';
  const r = await fetchImpl(u, { headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml' } });
  if (!r.ok) return [];
  return lerGoogleNews(await r.text(), max);
}

async function wikipedia(q, { fetchImpl, max }) {
  const u = 'https://pt.wikipedia.org/w/api.php?action=query&list=search&format=json&utf8=1&srlimit=' + max + '&srsearch=' + encodeURIComponent(q);
  const r = await fetchImpl(u, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!r.ok) return [];
  const j = await r.json().catch(() => ({}));
  return (((j.query || {}).search) || []).slice(0, max).map((s) => ({
    titulo: decodificar(s.title), url: 'https://pt.wikipedia.org/wiki/' + encodeURIComponent(String(s.title).replace(/ /g, '_')), trecho: decodificar(s.snippet).slice(0, 400),
  }));
}

// Cotação de moedas (AwesomeAPI, grátis e sem chave) quando a pergunta fala de dólar, euro, bitcoin ou cotação.
const MOEDAS = [[/d[oó]lar/i, 'USD-BRL', 'Dólar'], [/euro/i, 'EUR-BRL', 'Euro'], [/bitcoin|btc/i, 'BTC-BRL', 'Bitcoin']];
async function cotacao(q, { fetchImpl }) {
  if (!/d[oó]lar|euro|bitcoin|btc|cota[cç][aã]o|c[aâ]mbio/i.test(q)) return [];
  const pares = MOEDAS.filter(([re]) => re.test(q));
  const lista = pares.length ? pares : [MOEDAS[0]];
  const r = await fetchImpl('https://economia.awesomeapi.com.br/json/last/' + lista.map((x) => x[1]).join(','), { headers: { 'User-Agent': UA, Accept: 'application/json' } }).catch(() => null);
  const j = r && r.ok ? await r.json().catch(() => ({})) : {};
  const achou = lista.map(([, par, nome]) => {
    const c = j[par.replace('-', '')];
    if (!c || !c.bid) return null;
    const quando = c.create_date ? ` em ${c.create_date}` : '';
    return { titulo: `Cotação ${nome} hoje (AwesomeAPI)`, url: 'https://economia.awesomeapi.com.br/json/last/' + par, trecho: `${nome}: compra R$ ${c.bid}, venda R$ ${c.ask}, variação ${c.pctChange}%${quando}.` };
  }).filter(Boolean);
  return achou.length ? achou : cambioReserva(lista, fetchImpl);
}

// #1733: a AwesomeAPI pode recusar pedidos que saem do Cloudflare; open.er-api (grátis, sem chave) é a reserva.
async function cambioReserva(lista, fetchImpl) {
  const out = [];
  for (const [, par, nome] of lista) {
    const base = par.split('-')[0];
    const r = await fetchImpl('https://open.er-api.com/v6/latest/' + base, { headers: { 'User-Agent': UA, Accept: 'application/json' } }).catch(() => null);
    if (!r || !r.ok) continue;
    const j = await r.json().catch(() => ({}));
    const brl = j && j.rates && j.rates.BRL;
    if (!brl) continue;
    const quando = j.time_last_update_utc ? ` (atualizado em ${j.time_last_update_utc})` : '';
    out.push({ titulo: `Cotação ${nome} hoje (ExchangeRate-API)`, url: 'https://open.er-api.com/v6/latest/' + base, trecho: `1 ${base} = R$ ${Number(brl).toFixed(4).replace('.', ',')}${quando}.` });
  }
  return out;
}

/** Lê o RSS do Bing News; o link do Bing traz o endereço real no parâmetro "url". */
function lerBingNews(xml, max = 5) {
  return lerGoogleNews(xml, max).map((f) => {
    try { const u = new URL(f.url); const real = u.hostname.endsWith('bing.com') && u.searchParams.get('url'); return real ? { ...f, url: real } : f; } catch { return f; }
  });
}

async function bingNews(q, { fetchImpl, max, recente }) {
  // Pergunta sobre "hoje/esta semana": mais novas primeiro e só dos últimos 7 dias (sem isso vinham notícias de setembro).
  const filtro = recente ? '&qft=sortbydate%3d%221%22+interval%3d%227%22' : '';
  const r = await fetchImpl('https://www.bing.com/news/search?format=rss&setlang=pt-BR&cc=BR' + filtro + '&q=' + encodeURIComponent(q), { headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml' } });
  if (!r.ok) return [];
  return lerBingNews(await r.text(), max);
}

/** GDELT: base aberta de notícias do mundo todo, atualizada a cada 15 minutos. */
async function gdelt(q, { fetchImpl, max }) {
  const u = 'https://api.gdeltproject.org/api/v2/doc/doc?mode=artlist&format=json&sort=datedesc&timespan=7d&maxrecords=' + max + '&query=' + encodeURIComponent(q + ' sourcelang:portuguese');
  const r = await fetchImpl(u, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!r.ok) return [];
  const j = await r.json().catch(() => ({})); // a GDELT responde texto quando limita pedidos
  return ((j && j.articles) || []).slice(0, max).filter((a) => a && a.url && a.title).map((a) => ({
    titulo: decodificar(a.title).slice(0, 200), url: a.url, trecho: `[${String(a.seendate || '').slice(0, 8)}] ${decodificar(a.title).slice(0, 300)} (${a.domain || ''})`,
  }));
}

// Tira da pergunta o que atrapalha o buscador ("cite a fonte", "com link", pontuação).
// Também tira palavras de pergunta e de tempo ("quais são as notícias mais recentes … nesta semana"): o Bing devolvia
// links sem relação com o assunto quando recebia a frase inteira.
const PALAVRAS_VAZIAS = new Set('qual quais que o a os as um uma uns umas de do da dos das em no na nos nas sobre para por com e é são foi ser me diga fale mostre quero saber hoje agora atual atuais nesta neste esta este essa esse semana mês ano últimas últimos última último recentes recente mais novas novidades notícias notícia cite citando citar'.split(' '));
const termoDeBusca = (q) => {
  const frase = String(q).replace(/\b(cite|citando|com|as|a)?\s*(fontes?|links?)\b[^.?!]*/gi, ' ').replace(/[?!.:;,"]+/g, ' ').replace(/\s+/g, ' ').trim();
  const chave = frase.split(' ').filter((p) => !PALAVRAS_VAZIAS.has(p.toLowerCase())).join(' ');
  return chave.length >= 3 ? chave : (frase || String(q));
};

// Cada fonte tem o próprio prazo: uma fonte lenta (ex.: DuckDuckGo bloqueando o Worker) não derruba as outras.
const comPrazo = (p, ms) => Promise.race([p, new Promise((ok) => setTimeout(() => ok([]), ms))]);

async function buscar(q, { fetchImpl = (...a) => fetch(...a), max = 5, ms = 4000 } = {}) {
  const termo = String(q || '').trim().slice(0, 300);
  if (termo.length < 2) return { fontes: [], de: null, contexto: contexto([]), rodape: '' };
  const limpo = termoDeBusca(termo);
  const fontesDe = { cotacao, duckduckgo: duckDuckGo, google_news: googleNews, bing_news: bingNews, gdelt, wikipedia };
  const recente = /not[ií]cia|semana|hoje|[uú]ltim|recente|agora|atual/i.test(termo);
  const ordem = recente ? ['cotacao', 'google_news', 'bing_news', 'gdelt', 'duckduckgo', 'wikipedia'] : ['cotacao', 'duckduckgo', 'wikipedia', 'bing_news', 'google_news'];
  const res = await Promise.all(ordem.map((n) => comPrazo(Promise.resolve().then(() => fontesDe[n](n === 'cotacao' ? termo : limpo, { fetchImpl, max, recente })).catch(() => []), ms)));
  const fontes = []; const vistos = new Set(); let de = null;
  res.forEach((lista, i) => {
    for (const f of lista || []) {
      if (fontes.length >= max || vistos.has(f.url)) continue;
      vistos.add(f.url); fontes.push(f); if (!de) de = ordem[i];
    }
  });
  // Quantas fontes cada serviço trouxe: vai no fim do stream para o teste mostrar qual serviço o Cloudflare alcança.
  const porFonte = Object.fromEntries(ordem.map((n, i) => [n, (res[i] || []).length]));
  return { fontes, de, porFonte, contexto: contexto(fontes), rodape: listaDeFontes(fontes) };
}

/** Bloco para o prompt: fontes numeradas e a regra de citar. */
function contexto(fontes) {
  const hoje = new Date().toLocaleDateString('pt-BR');
  if (!fontes || !fontes.length) {
    return `Resultados da busca na web feita agora (${hoje}):\nNenhuma fonte encontrada na web para esta pesquisa.\nREGRA OBRIGATÓRIA: Diga "não encontrei fontes agora". NUNCA invente notícias, leis, projetos de lei, datas, valores ou links.`;
  }
  return `Resultados de uma busca na web feita agora (${hoje}) (use se ajudar e cite com [n] logo depois da frase):\n`
    + fontes.map((f, i) => `[${i + 1}] ${f.titulo} — ${f.url}\n${f.trecho}`).join('\n')
    + '\nSe os resultados não responderem ou forem insuficientes, diga expressamente "não encontrei fontes agora". NUNCA invente notícias, leis, estatísticas ou fontes.';
}

function listaDeFontes(fontes) {
  if (!fontes || !fontes.length) return '';
  return '\n\n**Fontes**\n' + fontes.map((f, i) => `${i + 1}. [${f.titulo}](${f.url})`).join('\n');
}

module.exports = { buscar, termoDeBusca, lerDuckDuckGo, lerGoogleNews, lerBingNews, contexto, listaDeFontes, urlReal };
