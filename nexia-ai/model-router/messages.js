'use strict';
// Normalização da requisição para todos os provedores.
// Mensagens com role "system" no meio do histórico (ex.: os resumos da memória do
// cortex, "MEMÓRIA COMPRIMIDA") são incorporadas ao system prompt. Antes da Fase 5 o
// caminho Anthropic filtrava role "system" e esses resumos sumiam.
function textOf(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map(p => (p && typeof p.text === 'string' ? p.text : '')).join('');
  return content == null ? '' : String(content);
}

/**
 * @param {{ system?: string, messages?: {role, content}[], maxTokens?: number, temperature?: number,
 *           tools?: {name, description, input_schema}[], toolChoice?: string, signal?: AbortSignal, timeoutMs?: number }} req
 */
function normalizeRequest(req = {}) {
  const system = [];
  if (req.system) system.push(String(req.system));
  const messages = [];
  for (const m of req.messages || []) {
    if (!m) continue;
    const content = textOf(m.content);
    if (m.role === 'system') { if (content.trim()) system.push(content); continue; }
    if (!content.trim()) continue;
    messages.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content });
  }
  return { ...req, system: system.join('\n\n'), messages };
}

/** Une o sinal do chamador com um timeout próprio. */
function withTimeout(signal, ms) {
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort(signal.reason);
  if (signal) { if (signal.aborted) ctrl.abort(signal.reason); else signal.addEventListener('abort', onAbort, { once: true }); }
  const t = ms ? setTimeout(() => ctrl.abort(new Error('timeout')), ms) : null;
  return { signal: ctrl.signal, done: () => { if (t) clearTimeout(t); if (signal) signal.removeEventListener('abort', onAbort); } };
}

/** Lê um corpo SSE e entrega o conteúdo de cada linha "data:". */
async function* sseData(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        const l = line.replace(/\r$/, '');
        if (l.startsWith('data:')) yield l.slice(5).trim();
      }
    }
    const rest = buf.replace(/\r$/, '');
    if (rest.startsWith('data:')) yield rest.slice(5).trim();
  } finally {
    try { reader.releaseLock(); } catch { /* já liberado */ }
  }
}

module.exports = { normalizeRequest, textOf, withTimeout, sseData };
