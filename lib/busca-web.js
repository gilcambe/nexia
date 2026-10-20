'use strict';
// Busca na web com citação (#826). Grátis e sem chave: DuckDuckGo (versão HTML) e, se ela não
// responder ou vier vazia, a busca da Wikipédia em português. Devolve até N fontes {titulo, url, trecho}
// e um bloco de contexto numerado [1], [2]… para a IA citar.

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

async function wikipedia(q, { fetchImpl, max }) {
  const u = 'https://pt.wikipedia.org/w/api.php?action=query&list=search&format=json&utf8=1&srlimit=' + max + '&srsearch=' + encodeURIComponent(q);
  const r = await fetchImpl(u, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!r.ok) return [];
  const j = await r.json().catch(() => ({}));
  return (((j.query || {}).search) || []).slice(0, max).map((s) => ({
    titulo: decodificar(s.title), url: 'https://pt.wikipedia.org/wiki/' + encodeURIComponent(String(s.title).replace(/ /g, '_')), trecho: decodificar(s.snippet).slice(0, 400),
  }));
}

async function buscar(q, { fetchImpl = (...a) => fetch(...a), max = 5 } = {}) {
  const termo = String(q || '').trim().slice(0, 300);
  if (termo.length < 2) return { fontes: [], de: null, contexto: '', rodape: '' };
  let fontes = [];
  try { fontes = await duckDuckGo(termo, { fetchImpl, max }); } catch { fontes = []; }
  let de = fontes.length ? 'duckduckgo' : null;
  if (!fontes.length) {
    try { fontes = await wikipedia(termo, { fetchImpl, max }); } catch { fontes = []; }
    de = fontes.length ? 'wikipedia' : null;
  }
  return { fontes, de, contexto: contexto(fontes), rodape: listaDeFontes(fontes) };
}

/** Bloco para o prompt: fontes numeradas e a regra de citar. */
function contexto(fontes) {
  if (!fontes || !fontes.length) return '';
  return 'Resultados de uma busca na web feita agora (use se ajudar e cite com [n] logo depois da frase):\n'
    + fontes.map((f, i) => `[${i + 1}] ${f.titulo} — ${f.url}\n${f.trecho}`).join('\n')
    + '\nSe os resultados não responderem, diga isso. Não invente fontes.';
}

function listaDeFontes(fontes) {
  if (!fontes || !fontes.length) return '';
  return '\n\n**Fontes**\n' + fontes.map((f, i) => `${i + 1}. [${f.titulo}](${f.url})`).join('\n');
}

module.exports = { buscar, lerDuckDuckGo, contexto, listaDeFontes, urlReal };
