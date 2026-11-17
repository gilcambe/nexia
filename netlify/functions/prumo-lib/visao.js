'use strict';
/**
 * Kernex Finance: leitor ÚNICO de imagem por IA grátis (holerite, folha de ponto, contas, cartões, dívidas, score,
 * milhas, CNIS...). 17/11/2026: o dono mandou o holerite e "não reconheceu": o leitor antigo tentava só a lista
 * 'fast', UMA de cada vez, 15 s cada, sem a NVIDIA e sem a Cloudflare (as que leem bem o print da carteira).
 *
 * Agora: corrida escalonada (como o print da carteira, #3940): começa com a 1ª IA de visão; a próxima entra quando
 * a anterior falha ou passam `esperaCorridaMs` (padrão 6 s); no máximo 3 ao mesmo tempo; a 1ª resposta com JSON vence.
 * A IA da Cloudflare (Workers AI, sem chave) entra na corrida como mais uma candidata.
 * Devolve o TEXTO da resposta (quem chama valida o JSON) ou null.
 */
const VISAO = [
  { provider: 'google', model: 'gemini-3.5-flash' },
  { provider: 'nvidia', model: 'meta/llama-3.2-90b-vision-instruct' },
  { provider: 'google', model: 'gemini-3.1-flash-lite' },
  { provider: 'groq', model: 'meta-llama/llama-4-scout-17b-16e-instruct' },
  { provider: 'mistral', model: 'mistral-small-latest' },
  { provider: 'google', model: 'gemini-flash-latest' },
  { provider: 'google', model: 'gemma-4-31b-it' },
  { provider: 'openrouter', model: 'google/gemma-3-27b-it:free' },
  { provider: 'openrouter', model: 'qwen/qwen2.5-vl-72b-instruct:free' },
];
const WORKERS = ['@cf/meta/llama-4-scout-17b-16e-instruct', '@cf/mistralai/mistral-small-3.1-24b-instruct'];
const PEDIDO = 'Leia a imagem e devolva o JSON.';

function temJson(t) {
  const m = /\{[\s\S]*\}/.exec(String(t || ''));
  if (!m) return false;
  try { JSON.parse(m[0]); return true; } catch { return false; }
}

/** Monta as candidatas: funções que devolvem o texto da resposta (ou lançam erro). */
function candidatas(deps, img, sistema, ms) {
  const out = [];
  let router = null;
  try { router = deps.getRouter && deps.getRouter(); } catch { router = null; }
  if (router) {
    const vistos = new Set();
    let fast = [];
    try { fast = deps.listFor ? deps.listFor('fast') : []; } catch { fast = []; }
    for (const d of [...VISAO, ...fast]) {
      if (!d || d.provider === 'anthropic' || vistos.has(d.provider + d.model)) continue;
      vistos.add(d.provider + d.model);
      let cap = {};
      try { cap = router.capabilities(d) || {}; } catch { continue; }
      if (!cap.available || !cap.vision) continue;
      out.push({ nome: `${d.provider}/${d.model}`, rodar: async () => {
        const r = await router.chat(d, { system: sistema, messages: [{ role: 'user', content: PEDIDO }], images: [img], maxTokens: 2048, temperature: 0, timeoutMs: ms });
        return r && r.text;
      } });
    }
  }
  const ai = deps.ai !== undefined ? deps.ai : globalThis.__NEXIA_AI__;
  if (ai && typeof ai.run === 'function') {
    const url = `data:${img.mime || 'image/jpeg'};base64,${img.data}`;
    // Cloudflare entra cedo (2ª posição): é grátis, sem chave e lê bem; não depende de cota de provedor externo.
    const w = WORKERS.map((modelo) => ({ nome: `workers/${modelo}`, rodar: async () => {
      const r = await ai.run(modelo, { messages: [{ role: 'system', content: sistema }, { role: 'user', content: [{ type: 'text', text: PEDIDO }, { type: 'image_url', image_url: { url } }] }], max_tokens: 2048, temperature: 0 });
      const t = r && (r.response !== undefined ? r.response : (r.result && r.result.response));
      return t && typeof t === 'object' ? JSON.stringify(t) : t;
    } }));
    out.splice(Math.min(1, out.length), 0, w[0]);
    out.push(...w.slice(1));
  }
  return out;
}

async function perguntarVisao(deps, img, sistema, opcoes) {
  const o = opcoes || {};
  const espera = Number.isFinite(deps.esperaCorridaMs) ? deps.esperaCorridaMs : 6000;
  const porIa = Number.isFinite(o.porIaMs) ? o.porIaMs : 40000;
  const total = Number.isFinite(o.totalMs) ? o.totalMs : 75000;
  const fila = candidatas(deps, img, sistema, porIa);
  if (!fila.length) return null;
  return new Promise((resolve) => {
    let proxima = 0, rodando = 0, fim = false;
    const timers = new Set();
    const agendar = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
    const acabar = (v) => { if (fim) return; fim = true; for (const t of timers) clearTimeout(t); timers.clear(); resolve(v); };
    agendar(() => acabar(null), total);
    const entrar = () => {
      if (fim) return;
      if (proxima >= fila.length) { if (!rodando) acabar(null); return; }
      const c = fila[proxima++]; rodando++;
      let terminou = false;
      const espTimer = proxima < fila.length ? agendar(() => { if (!terminou && rodando < 3) entrar(); }, espera) : null;
      const concluir = (texto) => {
        if (terminou) return; terminou = true; rodando--;
        if (espTimer) { clearTimeout(espTimer); timers.delete(espTimer); }
        if (fim) return;
        if (temJson(texto)) return acabar(String(texto));
        entrar();
      };
      agendar(() => concluir(null), porIa + 2000);
      Promise.resolve().then(c.rodar).then(concluir, () => concluir(null));
    };
    entrar();
  });
}

module.exports = { perguntarVisao, VISAO, WORKERS };
