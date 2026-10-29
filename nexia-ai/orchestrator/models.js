'use strict';
// Escolha de modelo pelo Orchestrator (spec §14: tarefa, custo, contexto, latência e
// capacidade). Classe de tarefa → lista de candidatos em ordem; vale o primeiro cujo
// provedor está configurado e suporta tool_call.
//
// ADR-FREE-03: o projeto não usa nada pago. O Claude (Anthropic) só entra se alguém configurar
// ANTHROPIC_API_KEY (cobra por uso). A Cerebras continua fora: o "plano grátis" exige cartão (crédito
// único de US$ 5 que vence em 30 dias), o que fere a regra "nada pago" (ADR-FREE-05).
// ADR-FREE-04/05 (regra do dono, 2026-10-06: "o cortex nunca pode parar de codar"): a lista grátis tem
// muitos provedores com cotas separadas; esgotou ou caiu um (429, 503 "high demand", pedido grande demais
// para o teto do modelo), vai para o próximo na hora. Ordem:
//   Groq (GROQ_API_KEY; cota por modelo, então 6 modelos somam 6 cotas)
//   → Google AI Studio (GEMINI_API_KEY; flash-latest, 2.5 Flash, flash-lite-latest, 2.5 Flash-Lite: cota por modelo)
//   → Codestral (CODESTRAL_API_KEY, opcional) → NVIDIA NIM (NVIDIA_API_KEY, opcional)
//   → Cloudflare Workers AI (CLOUDFLARE_AI_TOKEN + CLOUDFLARE_AI_ACCOUNT_ID) → Mistral (MISTRAL_API_KEY)
//   → OpenRouter ":free" (OPENROUTER_API_KEY)
//   → Z.ai (ZAI_API_KEY, opcional): glm-4.7-flash e glm-4.5-flash, grátis, só cadastro com e-mail (~1 pedido/seg, ~1.000/dia).
//   → LLM7.io SEM CHAVE (codestral-latest, gpt-oss-20b; 30 pedidos/min, 100 mil tokens/dia; LLM7_API_KEY opcional).
//   → Kilo Gateway SEM CHAVE (sempre disponível): os 5 melhores modelos ":free" do catálogo vivo do gateway.
// Só depois de o Kilo também falhar a execução espera a cota voltar (WAITING_AI_QUOTA) e é retomada sozinha.
// Gemma pelo AI Studio ficou de fora: sem garantia de tool_call no endpoint compatível com OpenAI.
// Provedor sem chave é pulado na hora. Os nomes mudam com o tempo: NEXIA_MODELS_<CLASSE>
// (ex.: NEXIA_MODELS_CODING="groq:openai/gpt-oss-120b,kilo:z-ai/glm-5:free,kilo:auto:1") troca a lista.
//
// Ordem de FREE por classe (cada classe começa por um provedor diferente, espalhando a carga):
//   coding  → Groq (GROQ_STRONG) primeiro, depois TAIL.
//   reasoning → os 4 Google AI Studio de TAIL primeiro, depois Groq (GROQ_STRONG), depois o resto de TAIL.
//   fast → Mistral, Cloudflare e Codestral primeiro, depois Groq (GROQ_FAST), depois TAIL.
// semRepetir() garante que não haja descritores repetidos (mesmo provider e model) em nenhuma classe.
const { getPlacar } = require('../model-router/cota');
const { getQualidade } = require('../model-router/qualidade');
const { contasExtra } = require('../model-router/providers/openai-compatible');
const g = model => ({ provider: 'groq', model });
const KILO = [1, 2, 3, 4, 5].map(n => ({ provider: 'kilo', model: `auto:${n}` }));
const TAIL = [
  { provider: 'google', model: 'gemini-flash-latest' }, { provider: 'google', model: 'gemini-2.5-flash' },
  { provider: 'google', model: 'gemini-flash-lite-latest' }, { provider: 'google', model: 'gemini-2.5-flash-lite' },
  { provider: 'codestral', model: 'codestral-latest' },
  { provider: 'nvidia', model: 'qwen/qwen3-coder-480b-a35b-instruct' }, { provider: 'nvidia', model: 'openai/gpt-oss-120b' },
  { provider: 'cloudflare', model: '@cf/openai/gpt-oss-120b' },
  { provider: 'mistral', model: 'mistral-small-latest' }, { provider: 'mistral', model: 'devstral-small-latest' },
  { provider: 'zai', model: 'glm-4.7-flash' }, { provider: 'zai', model: 'glm-4.5-flash' },
  // #955: catálogo vivo dos :free da OpenRouter (auto:N = N-ésimo grátis com tools; trava free_only no provedor).
  ...[1, 2, 3].map(n => ({ provider: 'openrouter', model: `auto:${n}` })),
  { provider: 'llm7', model: 'codestral-latest' }, { provider: 'llm7', model: 'gpt-oss-20b' },
  ...KILO];
const GROQ_STRONG = ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'moonshotai/kimi-k2-instruct-0905', 'llama-3.3-70b-versatile',
  'openai/gpt-oss-20b', 'meta-llama/llama-4-scout-17b-16e-instruct'];
const GROQ_FAST = ['openai/gpt-oss-20b', 'meta-llama/llama-4-scout-17b-16e-instruct', 'qwen/qwen3.8-27b', 'llama-3.3-70b-versatile',
  'openai/gpt-oss-120b', 'moonshotai/kimi-k2-instruct-0905'];

// Descritores fixos usados no início de classes de FREE.
const GOOGLE4 = TAIL.slice(0, 4);
const RESTO_TAIL = TAIL.slice(4);
const MISTRAL_SMALL = { provider: 'mistral', model: 'mistral-small-latest' };
const CLOUDFLARE_GPT_OSS = { provider: 'cloudflare', model: '@cf/openai/gpt-oss-120b' };
const CODESTRA_LATEST = { provider: 'codestral', model: 'codestral-latest' };

/** Remove descritores repetidos (mesmo provider e model), mantendo o primeiro. */
function semRepetir(lista) {
  const visto = new Set();
  return lista.filter(d => {
    const chave = `${d.provider}::${d.model}`;
    if (visto.has(chave)) return false;
    visto.add(chave);
    return true;
  });
}

const FREE = Object.freeze({
  reasoning: semRepetir([...GOOGLE4, ...GROQ_STRONG.map(g), ...RESTO_TAIL]),
  coding: semRepetir([...GROQ_STRONG.map(g), ...TAIL]),
  fast: semRepetir([MISTRAL_SMALL, CLOUDFLARE_GPT_OSS, CODESTRA_LATEST, ...GROQ_FAST.map(g), ...TAIL]),
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
  const base = CLASSES[key];
  const res = custom.length ? custom : base;
  return Array.isArray(res) ? res : [];
}

/** @returns {{ provider, model }[]} candidatos disponíveis para a classe */
function candidates(router, cls, env = process.env) {
  const lista = listFor(cls, env).filter(d => {
    try { const c = router.capabilities(d); return c && c.available !== false && c.tool_call; } catch { return false; }
  });
  // Placar de cota (cota.js): modelo sem cota fica de fora até a cota voltar, em todas as execuções.
  // #832: placar de qualidade: comprovado bom nesta classe sobe, comprovado ruim desce.
  return getQualidade().ordenar(getPlacar().ordenar(lista), key(cls));
}
const key = cls => (Object.prototype.hasOwnProperty.call(CLASSES, cls) ? cls : 'coding');

/** @returns {{ provider, model, contasExtra }[]} candidatos disponíveis para a classe, incluindo contas extras */
function candidatesWithExtraAccounts(router, cls, env = process.env) {
  const lista = listFor(cls, env).filter(d => {
    try { const c = router.capabilities(d); return c && c.available !== false && c.tool_call; } catch { return false; }
  }).map(d => ({ ...d, contasExtra: contasExtra(d.provider) }));
  // Placar de cota (cota.js): modelo sem cota fica de fora até a cota voltar, em todas as execuções.
  // #832: placar de qualidade: comprovado bom nesta classe sobe, comprovado ruim desce.
  return getQualidade().ordenar(getPlacar().ordenar(lista), key(cls));
}

/** @returns {{ provider, model }[]} candidatos disponíveis para a classe, incluindo dinamicamente cohere e huggingface */
function dynamicCandidates(router, cls, env = process.env) {
  const lista = listFor(cls, env).filter(d => {
    try { const c = router.capabilities(d); return c && c.available !== false && c.tool_call; } catch { return false; }
  });
  // Adiciona provedores dinâmicos se existirem em PROVEDORES do central
  if (env.PROVEDORES && env.PROVEDORES.includes('cohere')) {
    lista.push({ provider: 'cohere', model: 'command-r' });
  }
  if (env.PROVEDORES && env.PROVEDORES.includes('huggingface')) {
    lista.push({ provider: 'huggingface', model: 'mistralai/Mistral-7B-Instruct-v0.3' });
  }
  // Placar de cota (cota.js): modelo sem cota fica de fora até a cota voltar, em todas as execuções.
  // #832: placar de qualidade: comprovado bom nesta classe sobe, comprovado ruim desce.
  return getQualidade().ordenar(getPlacar().ordenar(lista), key(cls));
}

module.exports = { CLASSES, FREE, semRepetir, candidates, candidatesWithExtraAccounts, dynamicCandidates, listFor, parseList };
