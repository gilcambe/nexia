'use strict';
// Escolha de modelo pelo Orchestrator (spec §14: tarefa, custo, contexto, latência e
// capacidade). Classe de tarefa → lista de candidatos em ordem; vale o primeiro cujo
// provedor está configurado e suporta tool_call.
//
// ADR-FREE-03: o projeto não usa nada pago. O Claude (Anthropic) só entra se alguém configurar
// ANTHROPIC_API_KEY (cobra por uso). A Cerebras saiu: passou a pedir pagamento.
// ADR-FREE-04 (regra do dono, 2026-10-05): o Cortex nunca para por falta de IA. A lista grátis tem
// vários provedores com cotas separadas; esgotou um, vai para o próximo; esgotaram todos, a execução
// espera a cota voltar e é retomada sozinha (nunca falha por cota). Ordem:
//   Groq (GROQ_API_KEY; cota por modelo, então 3 modelos somam 3 cotas)
//   → GitHub Models (token do próprio GitHub Actions, sem cadastro)
//   → Google Gemini (GEMINI_API_KEY; 2.5 Flash, poucos pedidos por dia)
//   → Cloudflare Workers AI (CLOUDFLARE_AI_TOKEN + CLOUDFLARE_ACCOUNT_ID; grátis por dia)
//   → Mistral (MISTRAL_API_KEY, plano Experiment grátis) → OpenRouter ":free" (OPENROUTER_API_KEY).
// Provedor sem chave é pulado na hora. Os nomes mudam com o tempo: NEXIA_MODELS_<CLASSE>
// (ex.: NEXIA_MODELS_CODING="groq:openai/gpt-oss-120b,google:gemini-2.5-flash") troca a lista.
const TAIL = [{ provider: 'github', model: 'openai/gpt-4.1' }, { provider: 'github', model: 'openai/gpt-4.1-mini' },
  { provider: 'google', model: 'gemini-2.5-flash' }, { provider: 'google', model: 'gemini-2.5-flash-lite' },
  { provider: 'cloudflare', model: '@cf/openai/gpt-oss-120b' }, { provider: 'mistral', model: 'mistral-small-latest' },
  { provider: 'openrouter', model: 'qwen/qwen3-coder:free' }, { provider: 'openrouter', model: 'openai/gpt-oss-120b:free' }];
const FREE = Object.freeze({
  reasoning: [{ provider: 'groq', model: 'openai/gpt-oss-120b' }, { provider: 'groq', model: 'qwen/qwen3.8-27b' },
    { provider: 'groq', model: 'openai/gpt-oss-20b' }, ...TAIL],
  coding: [{ provider: 'groq', model: 'openai/gpt-oss-120b' }, { provider: 'groq', model: 'qwen/qwen3.8-27b' },
    { provider: 'groq', model: 'openai/gpt-oss-20b' }, ...TAIL],
  fast: [{ provider: 'groq', model: 'openai/gpt-oss-20b' }, { provider: 'groq', model: 'qwen/qwen3.8-27b' },
    { provider: 'groq', model: 'openai/gpt-oss-120b' }, ...TAIL],
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
