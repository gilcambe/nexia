'use strict';
// Escolha de modelo pelo Orchestrator (spec §14: tarefa, custo, contexto, latência e
// capacidade). Classe de tarefa → lista de candidatos em ordem; vale o primeiro cujo
// provedor está configurado e suporta tool_call.
//
// ADR-FREE-03: o projeto não usa nada pago. O Claude (Anthropic) só entra se alguém configurar
// ANTHROPIC_API_KEY (cobra por uso). Sem ela, valem as opções grátis, na ordem: Google Gemini
// (GEMINI_API_KEY, AI Studio; o 2.5 Pro foi aposentado para contas novas em 2026-10), Groq (GROQ_API_KEY), Cerebras (CEREBRAS_API_KEY) e modelos
// ":free" do OpenRouter (OPENROUTER_API_KEY). Os nomes mudam com o tempo: NEXIA_MODELS_<CLASSE>
// (ex.: NEXIA_MODELS_CODING="google:gemini-3.1-pro-preview,groq:openai/gpt-oss-120b") troca a lista.
const FREE = Object.freeze({
  reasoning: [{ provider: 'google', model: 'gemini-3.1-pro-preview' }, { provider: 'google', model: 'gemini-2.5-flash' }, { provider: 'groq', model: 'openai/gpt-oss-120b' },
    { provider: 'cerebras', model: 'gpt-oss-120b' }, { provider: 'openrouter', model: 'qwen/qwen3-coder:free' }],
  coding: [{ provider: 'google', model: 'gemini-3.1-pro-preview' }, { provider: 'google', model: 'gemini-2.5-flash' }, { provider: 'groq', model: 'openai/gpt-oss-120b' },
    { provider: 'cerebras', model: 'gpt-oss-120b' }, { provider: 'openrouter', model: 'qwen/qwen3-coder:free' }],
  fast: [{ provider: 'google', model: 'gemini-2.5-flash' }, { provider: 'groq', model: 'openai/gpt-oss-20b' },
    { provider: 'cerebras', model: 'gpt-oss-120b' }, { provider: 'openrouter', model: 'qwen/qwen3-coder:free' }],
});

const CLASSES = Object.freeze({
  reasoning: [{ provider: 'anthropic', model: 'claude-opus-5-5' }, { provider: 'anthropic', model: 'claude-sonnet-5-5' }, ...FREE.reasoning],
  coding: [{ provider: 'anthropic', model: 'claude-sonnet-5-5' }, { provider: 'anthropic', model: 'claude-opus-5-5' }, ...FREE.coding],
  fast: [{ provider: 'anthropic', model: 'claude-haiku-4-5-20251001' }, { provider: 'anthropic', model: 'claude-sonnet-5-5' }, ...FREE.fast],
});

/** "provedor:modelo,provedor:modelo" → descritores (o modelo pode ter ":" e "/"). */
function parseList(text) {
  return String(text || '').split(',').map(s => s.trim()).filter(Boolean).map(s => {
    const i = s.indexOf(':');
    return i > 0 ? { provider: s.slice(0, i), model: s.slice(i + 1) } : null;
  }).filter(d => d && /^[a-z0-9-]{2,32}$/.test(d.provider) && /^[A-Za-z0-9._:/-]{1,120}$/.test(d.model));
}

function listFor(cls, env = process.env) {
  const key = Object.prototype.hasOwnProperty.call(CLASSES, cls) ? cls : 'coding';
  const custom = parseList(env[`NEXIA_MODELS_${key.toUpperCase()}`]);
  return custom.length ? custom : CLASSES[key];
}

/** @returns {{ provider, model }[]} candidatos disponíveis para a classe */
function candidates(router, cls, env = process.env) {
  return listFor(cls, env).filter(d => {
    try { const c = router.capabilities(d); return c && c.available !== false && c.tool_call; } catch { return false; }
  });
}

module.exports = { CLASSES, FREE, candidates, listFor, parseList };
