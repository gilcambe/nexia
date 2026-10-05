'use strict';
// Clonar site, modo design leve (ADR-CLONE-01): sem navegador, cabe na tarefa do Cortex (GitHub Actions ou
// server.js). Baixa o HTML e até 6 folhas de estilo, lê como texto e devolve a base visual. Cada endereço
// (inclusive redirecionamentos) passa pela validação de URL e de DNS. Qualquer falha → null (o Designer
// segue sem base visual).

const { UA, validateUrl, checkResolved, defaultLookup } = require('./url');
const { parseHtml, parseCss, summarize } = require('./css');
const { designBase } = require('./design');

const MAX_HTML = 1_500_000;
const MAX_CSS = 1_000_000;
const MAX_SHEETS = 6;

/** Lê o corpo até max bytes (texto). */
async function readText(res, max) {
  if (res.body && typeof res.body.getReader === 'function') {
    const reader = res.body.getReader();
    const chunks = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.length;
      if (size >= max) { reader.cancel().catch(() => {}); break; }
    }
    return Buffer.concat(chunks.map(c => Buffer.from(c))).subarray(0, max).toString('utf8');
  }
  return String(await res.text()).slice(0, max);
}

/**
 * GET com redirecionamento manual (até 4), cada salto validado. Sem cookies nem credenciais.
 * @returns {Promise<{ url: string, status: number, type: string, text: string } | null>}
 */
async function safeGet(url, { fetchImpl, lookup, max, accept, timeoutMs = 15000 }) {
  let current = url;
  for (let hop = 0; hop < 5; hop++) {
    const v = validateUrl(current);
    if (!v.ok) return null;
    if (!(await checkResolved(v.host, lookup)).ok) return null;
    let res;
    try {
      res = await fetchImpl(v.url, { method: 'GET', redirect: 'manual', credentials: 'omit',
        headers: { 'User-Agent': UA, Accept: accept }, signal: AbortSignal.timeout(timeoutMs) });
    } catch { return null; }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers && res.headers.get && res.headers.get('location');
      if (res.body && res.body.cancel) res.body.cancel().catch(() => {});
      if (!loc) return null;
      try { current = new URL(loc, v.url).href; } catch { return null; }
      continue;
    }
    const type = (res.headers && res.headers.get && res.headers.get('content-type')) || '';
    if (res.status !== 200) { if (res.body && res.body.cancel) res.body.cancel().catch(() => {}); return { url: v.url, status: res.status, type, text: '' }; }
    return { url: v.url, status: 200, type, text: await readText(res, max) };
  }
  return null;
}

/**
 * Base visual de um site público, sem navegador.
 * @param {string} url
 * @param {{ fetchImpl?: typeof fetch, lookup?: Function|null }} [o]  lookup=null desliga o DNS (testes)
 * @returns {Promise<{ base: object, tokens: object, source: { url, host } } | null>}
 */
async function fetchDesign(url, { fetchImpl = (...a) => fetch(...a), lookup = defaultLookup() } = {}) {
  const v = validateUrl(url);
  if (!v.ok) return null;
  try {
    const page = await safeGet(v.url, { fetchImpl, lookup: lookup || undefined, max: MAX_HTML, accept: 'text/html,application/xhtml+xml' });
    if (!page || page.status !== 200 || !/html|^$/.test(page.type)) return null;
    const { tokens, css } = parseHtml(page.text, page.url);
    for (const href of css.slice(0, MAX_SHEETS)) {
      const sheet = await safeGet(href, { fetchImpl, lookup: lookup || undefined, max: MAX_CSS, accept: 'text/css,*/*;q=0.1' });
      if (sheet && sheet.status === 200 && !/html/.test(sheet.type)) parseCss(sheet.text, tokens);
    }
    const host = new URL(page.url).hostname;
    return { base: designBase(tokens, { host }), tokens: summarize(tokens), source: { url: page.url, host } };
  } catch {
    return null;
  }
}

module.exports = { fetchDesign, safeGet };
