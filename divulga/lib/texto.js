'use strict';
// Texto dos posts: pede à IA grátis (Groq, depois Gemini). Sem IA, usa um modelo fixo. Nunca para.
const tempo = () => AbortSignal.timeout(30000);

function linkUtm(link, rede) {
  const u = new URL(link);
  u.searchParams.set('utm_source', rede);
  u.searchParams.set('utm_medium', 'social');
  u.searchParams.set('utm_campaign', 'divulga');
  return u.toString();
}

const pedido = (c, assunto) =>
  `Escreva um post curto de rede social em português do Brasil para "${c.nome}" sobre: ${assunto}. ` +
  'Até 300 caracteres, tom animado e simples, sem link, sem hashtags, sem aspas e sem chamada para ação no fim (ela é acrescentada depois).';

/** IA grátis Groq. `maxTokens` opcional (padrão 200, igual ao de sempre). */
async function groq(prompt, env, fetchImpl, { maxTokens = 200 } = {}) {
  const r = await fetchImpl('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST', signal: tempo(),
    headers: { Authorization: `Bearer ${env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'llama-3.3-70b-versatile', temperature: 0.9, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!r.ok) throw new Error(`Groq HTTP ${r.status}`);
  const j = await r.json();
  return j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
}

/** IA grátis Gemini (reserva do Groq). */
async function gemini(prompt, env, fetchImpl) {
  const r = await fetchImpl('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent', {
    method: 'POST', signal: tempo(),
    headers: { 'x-goog-api-key': env.GEMINI_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  if (!r.ok) throw new Error(`Gemini HTTP ${r.status}`);
  const j = await r.json();
  const p = j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts;
  return p && p.map(x => x.text || '').join('');
}

/** Texto base (sem link e sem hashtags) sobre um assunto do cliente. */
async function textoIA(cliente, assunto, { env = {}, fetchImpl = fetch, log = () => {} } = {}) {
  const prompt = pedido(cliente, assunto);
  const fontes = [env.GROQ_API_KEY && groq, env.GEMINI_API_KEY && gemini].filter(Boolean);
  for (const f of fontes) {
    try {
      const t = String((await f(prompt, env, fetchImpl)) || '').replace(/^["“]|["”]$/g, '').trim();
      if (t.length >= 30) return t.slice(0, 320);
    } catch (e) { log(`IA falhou: ${e.message}`); }
  }
  return `${cliente.nome}: ${assunto}. Conheça agora e comece hoje!`;
}

module.exports = { linkUtm, textoIA, groq, gemini };
