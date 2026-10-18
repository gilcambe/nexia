'use strict';

// ── fetchWithTimeout helper ──
async function _fetchTimeout(url, opts = {}, ms = 25000) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ctrl.signal }); }
  finally { clearTimeout(tid); }
}

/**
 * ╔══════════════════════════════════════════════════════╗
 * ║  NEXIA OS — Busca na Web com Citação v1.0            ║
 * ║  DuckDuckGo HTML (grátis, sem API key)              ║
 * ╚══════════════════════════════════════════════════════╝
 */
const { admin, db } = require('./firebase-init');
const { requireBearerAuth, HEADERS, makeHeaders } = require('./middleware');

const DDG_BASE = 'https://html.duckduckgo.com/html/';

// Extrai resultado de busca do HTML do DuckDuckGo
function parseDuckDuckGo(html) {
  const results = [];
  // Busca blocos de resultado .result
  const resultRegex = /<div\s+class="result[^"]*"[\s\S]*?<\/div>\s*<\/div>/gi;
  let match;
  while ((match = resultRegex.exec(html)) !== null) {
    const block = match[0];
    const titleMatch = block.match(/<a\s+rel="nofollow"\s+class="result__a"[\s\S]*?>([\s\S]*?)<\/a>/);
    const urlMatch = block.match(/<a\s+rel="nofollow"\s+class="result__a"[\s\S]*?href="([^"]+)"/);
    const snippetMatch = block.match(/<a\s+class="result__snippet"[\s\S]*?>([\s\S]*?)<\/a>/);
    if (titleMatch && urlMatch) {
      let title = titleMatch[1].replace(/<[^>]*>/g, '').trim();
      let url = urlMatch[1];
      // DDG usa redirect com parâmetro u=, extrai URL real
      const uMatch = url.match(/[?&]u=([^&]+)/);
      if (uMatch) {
        try { url = decodeURIComponent(uMatch[1]); } catch { }
      }
      let snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, '').trim() : '';
      if (title && url) results.push({ title, url, snippet });
    }
  }
  return results;
}

// Sanitiza texto para exibição (remove tags residuais e colapsa espaços)
function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

exports.handler = async (event) => {
  const headers = makeHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (!db) return { statusCode: 503, headers: makeHeaders ? makeHeaders(event) : HEADERS, body: JSON.stringify({ ok: false, error: 'Firebase indisponível.' }) };

  const authErr = await requireBearerAuth(event);
  if (authErr) return authErr;

  try {
    let body = {};
    try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON inválido no body' }) }; }

    const { query, tenantId } = body;
    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'query é obrigatória (mínimo 2 caracteres)' }) };
    }

    const q = encodeURIComponent(query.trim());
    const res = await _fetchTimeout(`${DDG_BASE}?q=${q}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36' }
    });

    if (!res.ok) {
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'Falha na busca externa', detail: `HTTP ${res.status}` }) };
    }

    const html = await res.text();
    const parsed = parseDuckDuckGo(html).slice(0, 8);

    if (!parsed.length) {
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, query, results: [], sources: [], answer: 'Não encontrei resultados para essa busca.' }) };
    }

    // Monta resposta com fontes no final
    const sources = parsed.map((r, i) => ({
      id: i + 1,
      title: cleanText(r.title),
      url: r.url,
      snippet: cleanText(r.snippet)
    }));

    // Resposta direta com citação inline numérica [1], [2]...
    const top = sources.slice(0, 3);
    const answerParts = top.map((s, i) => `${cleanText(s.snippet) || cleanText(s.title)} [${i + 1}]`).join(' ');

    const answer = `${answerParts}\n\n---\n**Fontes:**\n${sources.map(s => `[${s.id}] ${s.title} — ${s.url}`).join('\n')}`;

    // Log de auditoria
    if (tenantId) {
      try {
        await db.collection('tenants').doc(tenantId).collection('busca_web_log').add({
          query,
          resultsCount: sources.length,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
      } catch { }
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, query, answer, results: sources, sources }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal error' }) };
  }
};
