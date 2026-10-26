'use strict';
// Busca na web com citação (#826). Grátis e sem chave: DuckDuckGo (versão HTML), Google News RSS e Wikipédia em português.
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

// Palavras de pergunta atrapalham a busca da Wikipédia (ela exige todos os termos).
const VAZIAS = new Set('quem qual quais quando onde como porque por que o a os as um uma de do da dos das em no na nos nas e é foi ser me diga sobre hoje agora atual esta essa este semana'.split(' '));
const termosChave = (q) => String(q).toLowerCase().replace(/[?!.,;:"]/g, ' ').split(/\s+/).filter((w) => w && !VAZIAS.has(w)).join(' ') || String(q);

/** Cada fonte tem o próprio prazo: uma fonte lenta ou bloqueada não derruba as outras. */
function comPrazo(fetchImpl, ms) {
  return (url, opts = {}) => {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = ctl ? setTimeout(() => ctl.abort(), ms) : null;
    return Promise.resolve(fetchImpl(url, ctl ? { ...opts, signal: ctl.signal } : opts)).finally(() => t && clearTimeout(t));
  };
}

async function buscar(q, { fetchImpl = (...a) => fetch(...a), max = 5, ms = 4000 } = {}) {
  const termo = String(q || '').trim().slice(0, 300);
  if (termo.length < 2) return { fontes: [], de: null, contexto: contexto([]), rodape: '' };
  const f = comPrazo(fetchImpl, ms);
  const chave = termosChave(termo);
  const noticia = /not[ií]cia|hoje|semana|agora|[uú]ltim|recente|20\d\d/i.test(termo);
  // As 3 fontes ao mesmo tempo (antes era uma depois da outra, dividindo o mesmo prazo).
  const [ddg, news, wiki] = await Promise.all([
    duckDuckGo(termo, { fetchImpl: f, max }).catch(() => []),
    googleNews(chave, { fetchImpl: f, max }).catch(() => []),
    wikipedia(chave, { fetchImpl: f, max: 3 }).catch(() => []),
  ]);
  const ordem = noticia ? [['google_news', news], ['duckduckgo', ddg], ['wikipedia', wiki]] : [['duckduckgo', ddg], ['wikipedia', wiki], ['google_news', news]];
  const vistos = new Set();
  const fontes = [];
  const de = [];
  for (const [nome, lista] of ordem) {
    for (const item of lista) {
      if (fontes.length >= max || vistos.has(item.url)) continue;
      vistos.add(item.url);
      fontes.push(item);
      if (!de.includes(nome)) de.push(nome);
    }
  }
  return { fontes, de: de.join('+') || null, contexto: contexto(fontes), rodape: listaDeFontes(fontes) };
}

/** Bloco para o prompt: fontes numeradas e a regra de citar. */
function contexto(fontes) {
  if (!fontes || !fontes.length) {
    return 'Resultados da busca na web feita agora:\nNenhuma fonte encontrada na web para esta pesquisa.\nREGRA OBRIGATÓRIA: Diga "não encontrei fontes agora". NUNCA invente notícias, leis, projetos de lei, datas, valores ou links.';
  }
  return 'Resultados de uma busca na web feita agora (use se ajudar e cite com [n] logo depois da frase):\n'
    + fontes.map((f, i) => `[${i + 1}] ${f.titulo} — ${f.url}\n${f.trecho}`).join('\n')
    + '\nSe os resultados não responderem ou forem insuficientes, diga expressamente "não encontrei fontes agora". NUNCA invente notícias, leis, estatísticas ou fontes.';
}

function listaDeFontes(fontes) {
  if (!fontes || !fontes.length) return '';
  return '\n\n**Fontes**\n' + fontes.map((f, i) => `${i + 1}. [${f.titulo}](${f.url})`).join('\n');
}

module.exports = { buscar, termosChave, lerDuckDuckGo, lerGoogleNews, contexto, listaDeFontes, urlReal };
