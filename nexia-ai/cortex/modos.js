'use strict';
// #831 (Melhoria C13): modos "Rápido / Pensar / Pesquisar" do composer do Cortex. Tudo grátis.
//   rapido    → modelo pequeno e rápido (Groq GPT-OSS 20B), sem o passo do orquestrador
//   pensar    → modelo de raciocínio (cadeia grátis de reasoning)
//   pesquisar → busca na web sem chave (DuckDuckGo e Wikipédia) e um modelo com contexto longo lê os resultados
const MODOS = Object.freeze({
  rapido: { intent: 'fast', maxTokens: 2048 },
  pensar: { intent: 'reasoning', maxTokens: 0 },
  pesquisar: { intent: 'analysis', maxTokens: 0, web: true },
});

const modoValido = m => (Object.prototype.hasOwnProperty.call(MODOS, m) ? m : null);

const limpar = t => String(t || '').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

async function comPrazo(fetchImpl, url, ms) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetchImpl(url, { signal: ctl.signal, headers: { 'User-Agent': 'nexia-cortex' } }); return r.ok ? await r.json() : null; }
  catch { return null; } finally { clearTimeout(t); }
}

/** Resultados da web (grátis, sem chave). Nunca falha: sem rede, devolve ''. */
async function buscarWeb(pergunta, fetchImpl = fetch, ms = 4000) {
  const q = encodeURIComponent(String(pergunta || '').slice(0, 200));
  const [ddg, wiki] = await Promise.all([
    comPrazo(fetchImpl, `https://api.duckduckgo.com/?q=${q}&format=json&no_html=1&skip_disambig=1`, ms),
    comPrazo(fetchImpl, `https://pt.wikipedia.org/w/api.php?action=query&list=search&srsearch=${q}&format=json&srlimit=4&origin=*`, ms),
  ]);
  const itens = [];
  if (ddg && ddg.AbstractText) itens.push(`- ${limpar(ddg.AbstractText)}${ddg.AbstractURL ? ` (${ddg.AbstractURL})` : ''}`);
  for (const r of ((ddg && ddg.RelatedTopics) || []).filter(x => x && x.Text).slice(0, 4)) itens.push(`- ${limpar(r.Text)}${r.FirstURL ? ` (${r.FirstURL})` : ''}`);
  for (const r of (((wiki && wiki.query) || {}).search || []).slice(0, 4)) itens.push(`- ${limpar(r.title)}: ${limpar(r.snippet)} (https://pt.wikipedia.org/wiki/${encodeURIComponent(String(r.title).replace(/ /g, '_'))})`);
  return itens.length ? `Resultados da web (cite a fonte entre parênteses; se não bastarem, diga que não achou):\n${itens.slice(0, 8).join('\n')}` : '';
}

module.exports = { MODOS, modoValido, buscarWeb };
