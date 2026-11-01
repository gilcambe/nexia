'use strict';

/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  NEXIA OS — CORTEX SUPREME v16.0                                     ║
 * ║  50 Providers de IA — Free Tier Prioritário                         ║
 * ║  Firebase seguro, streaming real, sem crashes                       ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

const { admin, db } = require('./firebase-init');

let memModule, actionModule, learnModule, autodevModule, ragModule;
try { memModule = require('./cortex-memory'); } catch { memModule = { load: async () => ({ history: [], summaries: [] }), save: async () => {}, buildContext: (h) => h, extractEntities: () => ({}) }; }
try { actionModule = require('./action-engine'); } catch { actionModule = { dispatch: async () => ({ ok: false, error: 'action-engine indisponível' }) }; }
try { learnModule = require('./cortex-learn'); } catch { learnModule = { buildLearningContext: async () => null, saveExample: async () => {} }; }
try { autodevModule = require('./autodev-engine'); } catch { autodevModule = null; }
try { ragModule = require('./rag-engine'); } catch { ragModule = { buildRAGContext: async () => '' }; }

const { guard, sanitizePrompt, validateAIAction, checkPermission, HEADERS, makeHeaders } = require('./middleware');
const { publicErrorBody } = require('../../lib/safe-error');
const { estimarTokens, otimizarHistorico } = require('../../lib/cortex-tokens');
const nexiaCortex = require('../../nexia-ai/cortex'); // NEXIA AI (Fase 4): resolver + contexto do Vault
const modos = require('../../nexia-ai/cortex/modos'); // #831: Rápido / Pensar / Pesquisar
const { classificarDificuldade, podeUsarCache } = require('../../nexia-ai/cortex/classificador'); // Q4 - Issue #1632
const { TEXTO: DECISOES_DONO } = require('../../nexia-ai/orchestrator/decisoes-dono'); // #824: memória do Cortex

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
  'Access-Control-Allow-Origin': (process.env.NEXIA_APP_URL ? process.env.NEXIA_APP_URL.split(',')[0].trim() : '*'),
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'X-Accel-Buffering': 'no'
};

// NEXIA CORTEX — SEM LIMITES: todos os planos têm acesso ilimitado
const PLAN_LIMITS = { master: -1, enterprise: -1, pro: -1, starter: -1, free: -1 };

// ══════════════════════════════════════════════════════════════════════
// 50 PROVIDERS — 🆓 Free | 💰 Pago | 🎁 Créditos signup
// ══════════════════════════════════════════════════════════════════════
const AI_CATALOG = {
  // ANTHROPIC (pago)
  claude:               { provider: 'anthropic',   model: 'claude-sonnet-4-6',                                    label: '✦ Claude Sonnet 4.6',          free: false },
  claude_opus:          { provider: 'anthropic',   model: 'claude-opus-4-5',                                      label: '✦ Claude Opus 4.5',            free: false },
  claude_haiku:         { provider: 'anthropic',   model: 'claude-haiku-4-5-20251001',                            label: '✦ Claude Haiku 4.5',           free: false },

  // OPENAI (pago)
  gpt4o:                { provider: 'openai',      model: 'gpt-4o',                                               label: '⚡ GPT-4o',                     free: false },
  gpt4o_mini:           { provider: 'openai',      model: 'gpt-4o-mini',                                          label: '⚡ GPT-4o Mini',                free: false },

  // GROQ 🆓 — https://console.groq.com — GROQ_API_KEY. Out/2026 a Groq só oferece gpt-oss-120b, gpt-oss-20b e
  // qwen3.8-27b; as chaves antigas (llama, mixtral...) foram mantidas e apontam para esses modelos.
  groq_llama4_scout:    { provider: 'groq',        model: 'openai/gpt-oss-20b',            label: '⚡ GPT-OSS 20B (Groq)',      free: true  },
  groq_llama4_maverick: { provider: 'groq',        model: 'openai/gpt-oss-120b',        label: '🧠 GPT-OSS 120B (Groq)',   free: true  },
  groq_llama3:          { provider: 'groq',        model: 'openai/gpt-oss-120b',                                      label: '🧠 GPT-OSS 120B (Groq)',        free: true  },
  groq_llama3_fast:     { provider: 'groq',        model: 'openai/gpt-oss-20b',                                 label: '⚡ GPT-OSS 20B Fast (Groq)', free: true  },
  groq_mixtral:         { provider: 'groq',        model: 'openai/gpt-oss-20b',                                   label: '⚡ GPT-OSS 20B (Groq)',       free: true  },
  groq_gemma2:          { provider: 'groq',        model: 'openai/gpt-oss-20b',                                         label: '⚡ GPT-OSS 20B (Groq)',         free: true  },
  groq_qwen:            { provider: 'groq',        model: 'qwen/qwen3.8-27b',                                         label: '🐉 Qwen 3.8 27B (Groq)',       free: true  },
  groq_deepseek_r1:     { provider: 'groq',        model: 'openai/gpt-oss-120b',                        label: '🧠 GPT-OSS 120B (Groq)',        free: true  },

  // GEMINI 🆓 — https://aistudio.google.com — GEMINI_API_KEY
  gemini_25_pro:        { provider: 'gemini',      model: 'gemini-3.1-pro-preview',                               label: '🌐 Gemini 3.1 Pro',            free: true  },
  gemini_25_flash:      { provider: 'gemini',      model: 'gemini-2.5-flash',                                     label: '🌐 Gemini 2.5 Flash',          free: true  },
  gemini_20_flash:      { provider: 'gemini',      model: 'gemini-2.0-flash',                                     label: '🌐 Gemini 2.0 Flash',          free: true  },
  gemini_flash_lite:    { provider: 'gemini',      model: 'gemini-2.5-flash-lite',                                label: '🌐 Gemini Flash Lite',         free: true  },

  // CEREBRAS — passou a cobrar (out/2026); fora das rotas padrão, só funciona se alguém configurar a chave
  cerebras_llama4:      { provider: 'cerebras',    model: 'llama-4-scout-17b-16e-instruct',                       label: '⚡ Llama 4 Scout (Cerebras)', free: true  },
  cerebras_llama3:      { provider: 'cerebras',    model: 'llama3.3-70b',                                         label: '⚡ Llama 3.3 70B (Cerebras)', free: true  },
  cerebras_qwen:        { provider: 'cerebras',    model: 'qwen-3-32b',                                           label: '⚡ Qwen 3 32B (Cerebras)',    free: true  },

  // OPENROUTER 🆓 — https://openrouter.ai/keys — OPENROUTER_API_KEY
  or_llama4_mav:        { provider: 'openrouter',  model: 'meta-llama/llama-4-maverick:free',                     label: '🌐 Llama 4 Maverick (OR)',    free: true  },
  or_deepseek_r1:       { provider: 'openrouter',  model: 'deepseek/deepseek-r1:free',                            label: '🌐 DeepSeek R1 (OR)',          free: true  },
  or_deepseek_v3:       { provider: 'openrouter',  model: 'deepseek/deepseek-v3-0324:free',                       label: '🌐 DeepSeek V3 (OR)',          free: true  },
  or_qwen3_235b:        { provider: 'openrouter',  model: 'qwen/qwen3-235b-a22b:free',                            label: '🌐 Qwen3 235B (OR)',           free: true  },
  or_qwen3_coder:       { provider: 'openrouter',  model: 'qwen/qwen3-coder-480b:free',                           label: '🌐 Qwen3 Coder 480B (OR)',    free: true  },
  or_gemma3_27b:        { provider: 'openrouter',  model: 'google/gemma-3-27b-it:free',                           label: '🌐 Gemma 3 27B (OR)',          free: true  },
  or_mistral_sm:        { provider: 'openrouter',  model: 'mistralai/mistral-small-3.1-24b-instruct:free',        label: '🌐 Mistral Small 3.1 (OR)',   free: true  },
  or_nvidia_nemotron:   { provider: 'openrouter',  model: 'nvidia/llama-3.1-nemotron-ultra-253b-v1:free',         label: '🌐 NVIDIA Nemotron 253B (OR)',free: true  },
  or_gpt_oss_120b:      { provider: 'openrouter',  model: 'openai/gpt-oss-120b:free',                             label: '🌐 GPT-OSS 120B (OR)',         free: true  },

  // MISTRAL 🆓 — https://console.mistral.ai — MISTRAL_API_KEY
  mistral_small:        { provider: 'mistral',     model: 'mistral-small-latest',                                 label: '🇫🇷 Mistral Small',             free: true  },
  mistral_codestral:    { provider: 'mistral',     model: 'codestral-latest',                                     label: '🇫🇷 Codestral (código)',         free: true  },
  mistral_nemo:         { provider: 'mistral',     model: 'open-mistral-nemo',                                    label: '🇫🇷 Mistral Nemo 12B',           free: true  },

  // COHERE 🆓 — https://dashboard.cohere.com — COHERE_API_KEY
  cohere_command:       { provider: 'cohere',      model: 'command-r-plus',                                       label: '🔵 Cohere Command R+',         free: true  },
  cohere_command_r:     { provider: 'cohere',      model: 'command-r',                                            label: '🔵 Cohere Command R',          free: true  },

  // NVIDIA NIM 🆓 — https://build.nvidia.com — NVIDIA_API_KEY
  nvidia_llama3:        { provider: 'nvidia',      model: 'meta/llama-3.3-70b-instruct',                          label: '🟢 Llama 3.3 70B (NVIDIA)',   free: true  },
  nvidia_deepseek_r1:   { provider: 'nvidia',      model: 'deepseek/deepseek-r1',                                 label: '🟢 DeepSeek R1 (NVIDIA)',      free: true  },
  nvidia_phi4:          { provider: 'nvidia',      model: 'microsoft/phi-4',                                      label: '🟢 Phi-4 (NVIDIA)',            free: true  },
  nvidia_gemma3_27b:    { provider: 'nvidia',      model: 'google/gemma-3-27b-it',                                label: '🟢 Gemma 3 27B (NVIDIA)',      free: true  },

  // HUGGING FACE 🆓 — https://huggingface.co/settings/tokens — HF_API_KEY
  hf_llama3:            { provider: 'huggingface', model: 'meta-llama/Llama-3.3-70B-Instruct',                    label: '🤗 Llama 3.3 70B (HF)',       free: true  },
  hf_qwen3:             { provider: 'huggingface', model: 'Qwen/Qwen3-235B-A22B',                                 label: '🤗 Qwen3 235B (HF)',           free: true  },
  hf_deepseek_r1:       { provider: 'huggingface', model: 'deepseek-ai/DeepSeek-R1',                              label: '🤗 DeepSeek R1 (HF)',          free: true  },

  // SAMBANOVA 🆓 — https://cloud.sambanova.ai — SAMBANOVA_API_KEY
  sambanova_llama3:     { provider: 'sambanova',   model: 'Meta-Llama-3.3-70B-Instruct',                          label: '🔴 Llama 3.3 70B (SambaNova)',free: true  },
  sambanova_deepseek:   { provider: 'sambanova',   model: 'DeepSeek-R1-Distill-Llama-70B',                        label: '🔴 DeepSeek R1 (SambaNova)',   free: true  },
  sambanova_qwen:       { provider: 'sambanova',   model: 'Qwen3-32B',                                            label: '🔴 Qwen3 32B (SambaNova)',     free: true  },

  // TOGETHER AI 🎁 — https://api.together.xyz — TOGETHER_API_KEY
  together_llama4:      { provider: 'together',    model: 'meta-llama/Llama-4-Scout-17B-16E-Instruct',            label: '🤝 Llama 4 Scout (Together)', free: true  },
  together_deepseek:    { provider: 'together',    model: 'deepseek-ai/DeepSeek-R1',                              label: '🤝 DeepSeek R1 (Together)',   free: true  },

  // DEEPSEEK 💰
  deepseek_v3:          { provider: 'deepseek',    model: 'deepseek-chat',                                        label: '💻 DeepSeek V3',               free: false },
  deepseek_r1:          { provider: 'deepseek',    model: 'deepseek-reasoner',                                    label: '💻 DeepSeek R1',               free: false },
  deepseek_coder:       { provider: 'deepseek',    model: 'deepseek-coder',                                       label: '💻 DeepSeek Coder',            free: false },

  // XAI (pago)
  grok3:                { provider: 'xai',         model: 'grok-3-fast',                                          label: '🚀 Grok-3 Fast',               free: false },

  // PERPLEXITY (pago)
  perplexity:           { provider: 'perplexity',  model: 'llama-3.1-sonar-large-128k-online',                    label: '🔍 Perplexity',                free: false },
  perplexity_fast:      { provider: 'perplexity',  model: 'llama-3.1-sonar-small-128k-online',                    label: '🔍 Perplexity Fast',           free: false },
};

// Roteador por intent — 100% free tier por padrão
const INTENT_ROUTER = {
  code:      'or_qwen3_coder',
  dev:       'groq_deepseek_r1',
  security:  'gemini_25_flash',
  write:     'groq_llama4_maverick',
  legal:     'gemini_25_pro',
  analysis:  'gemini_25_flash',
  vision:    'gemini_20_flash',
  search:    'perplexity',
  news:      'perplexity_fast',
  finance:   'groq_llama4_maverick',
  huge_doc:  'gemini_25_pro',
  realtime:  'grok3',
  fast:      'groq_llama3_fast',
  chat:      'groq_llama4_scout',
  swarm:     'or_qwen3_235b',
  action:    'groq_llama3_fast',
  auto:      'groq_llama4_scout',
  reasoning: 'or_deepseek_r1',
  rag:       'cohere_command_r',
};

const STATIC_AGENTS = {
  orchestrator: { system: `Você é o CORTEX ORCHESTRATOR v16 — Sistema de Auto-Programação da NEXIA OS.\nAnalise a mensagem e retorne SOMENTE JSON válido, sem texto fora do JSON.\nEsquema EXATO:\n{"type":"chat|code|action|swarm|image|autodev","intent":"chat|code|dev|security|write|legal|analysis|vision|search|news|finance|huge_doc|realtime|fast","agents":["dev","security","business"],"actions":[{"type":"createTask","data":{"titulo":"Título obrigatório","descricao":"","prioridade":"media","status":"pendente"}},{"type":"createClient","data":{"nome":"Nome obrigatório"}},{"type":"createMeeting","data":{"titulo":"Título","dataHora":"2026-01-01T10:00"}},{"type":"createFinance","data":{"descricao":"Desc","valor":0,"tipo":"receita"}},{"type":"createNote","data":{"conteudo":"Conteúdo"}}],"autodev":{"comando":"criar_modulo|corrigir_bug|gerar_funcao|deploy","spec":"Especificação completa do que deve ser criado","modulo":"nome-do-modulo"},"image_request":{"prompt":"...","style":"realistic"},"model_override":"groq_llama4_scout|or_deepseek_r1|gemini_25_pro|cerebras_llama3|claude|gpt4o","response":"Resposta em português"}\nREGRAS CRÍTICAS:\n1. createTask SEMPRE inclui campo \"titulo\" com texto real\n2. createClient SEMPRE inclui campo \"nome\" com texto real\n3. createMeeting SEMPRE inclui \"titulo\" e \"dataHora\"\n4. Se usuário pede para criar módulo/feature/sistema → use type=autodev\n5. Nunca retorne data:{} vazio\n6. response deve ser em português` },
  dev:       { system: 'Você é o DEV AGENT — Principal Engineer da NEXIA. Especialista em Firebase, Netlify Functions, JavaScript, TypeScript, React, Python, arquitetura SaaS multi-tenant. Responda em português com código completo e funcional.' },
  security:  { system: 'Você é o SECURITY AGENT — CISO Virtual da NEXIA. Especialista em OWASP, LGPD/GDPR, Firebase Security Rules, pentest, criptografia. Responda em português, nunca minimize riscos.' },
  business:  { system: 'Você é o BUSINESS AGENT — Consultor Estratégico da NEXIA. Especialista em SaaS, MRR, churn, pricing, vendas, marketing. Responda em português de forma executiva.' },
  finance:   { system: 'Você é o FINANCE AGENT — CFO Virtual da NEXIA. Especialista em DRE, fluxo de caixa, valuation, análise de crédito. Responda com precisão numérica.' },
  legal:     { system: 'Você é o LEGAL AGENT — especialista em contratos SaaS, LGPD, editais. Analise contratos e identifique riscos. Responda em português acessível.' },
  architect: { system: 'Você é o ARCHITECT AGENT — especialista em arquitetura de sistemas, microserviços, serverless, bancos de dados. Projete sistemas robustos. Responda em português.' },
};

// ═══ CHAMADAS AOS MODELOS (NEXIA AI Fase 5: Model Router) ═════════════
// Todas as chamadas passam por nexia-ai/model-router (SDK oficial no Claude, streaming
// real, resumos da memória preservados). O AI_CATALOG acima continua sendo o catálogo
// do cortex; o router recebe só { provider, model }. As funções stream*/callFreeProvider
// anteriores foram substituídas pelos adapters do router (ADR-F5-02).
const modelRouter = require('../../nexia-ai/model-router');
const descOf = key => { const ai = AI_CATALOG[key] || AI_CATALOG.groq_llama3; return { provider: ai.provider, model: ai.model }; };
const labelOf = (provider, model) => { const hit = Object.values(AI_CATALOG).find(a => a.provider === provider && a.model === model); return hit ? (hit.label || hit.model) : model; };

// Só tenta modelos cujo provedor tem chave configurada: primeiro os pedidos, depois a lista grátis
// padrão (ADR-FREE-03). Sem isso, o padrão "Groq" falhava em quem só cadastrou o Gemini.
const CHAT_DEFAULTS = ['groq_llama3', 'groq_llama4_scout', 'groq_qwen', 'gemini_25_flash', 'gemini_25_pro', 'or_gpt_oss_120b', 'mistral_small', 'deepseek_v3', 'claude_haiku', 'claude'];
function usable(key) {
  if (!AI_CATALOG[key]) return false;
  try { return modelRouter.getRouter().capabilities(descOf(key)).available !== false; } catch { return false; }
}
function chain(...keys) {
  const out = [];
  for (const k of [...keys, ...CHAT_DEFAULTS]) if (!out.includes(k) && usable(k)) out.push(k);
  return out;
}
async function callChain(system, messages, keys, maxTok) {
  let last;
  for (const k of keys) {
    try { return { text: await callSync(system, messages, k, maxTok), key: k }; } catch (e) { last = e; }
  }
  throw last || new Error('Nenhuma IA configurada.');
}

async function callSync(system, messages, modelKey, maxTok) {
  const out = await modelRouter.getRouter().chat(descOf(modelKey), { system, messages, maxTokens: maxTok || 8192 });
  return out.text;
}

// ═══ IMAGEM ═══════════════════════════════════════════════════════════
// #1640: pedido de imagem em português comum ("crie uma imagem de...", "desenhe um logo...").
const PEDE_IMAGEM = /\b(cri[ea]r?|ger[ea]r?|fa[cç]a|fazer|desenh[ea]r?|ilustr[ea]r?|mont[ea]r?)\b[^.?!\n]{0,40}\b(imagem|imagens|foto|desenho|ilustra[cç][aã]o|logo|logotipo|figura|arte)\b/i;

// #1815: última reserva quando Groq e os outros provedores falham (limite por minuto): o Workers AI do
// próprio Cloudflare (binding "AI", grátis), sem chave. Tenta o modelo grande e depois o pequeno.
const MODELOS_RESERVA = ['@cf/meta/llama-3.3-70b-instruct-fp8-fast', '@cf/meta/llama-3.1-8b-instruct'];
async function reservaWorkersAI(system, msgs, ai = globalThis.__NEXIA_AI__) {
  if (!ai || typeof ai.run !== 'function') return null;
  const messages = [{ role: 'system', content: String(system || '').slice(0, 12000) }, ...(msgs || []).filter(m => m && m.content).slice(-10).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content).slice(0, 6000) }))];
  for (const modelo of MODELOS_RESERVA) {
    try {
      const r = await ai.run(modelo, { messages, max_tokens: 2048 });
      let texto = r && (r.response || (r.result && r.result.response));
      // O Workers AI devolve objeto quando a resposta é um JSON; sem isso o chat mostrava "[object Object]".
      if (texto && typeof texto === 'object') texto = JSON.stringify(texto);
      if (texto && String(texto).trim()) return { text: String(texto), modelo: 'Workers AI ' + modelo.split('/').pop() };
    } catch (e) { console.warn('[CORTEX] Reserva Workers AI falhou:', modelo, e && e.message); }
  }
  return null;
}

async function generateImage(prompt, style) {
  // Grátis primeiro: FLUX schnell pelo binding do Workers AI (o mesmo que lê os anexos, #1671).
  const ai = globalThis.__NEXIA_AI__;
  if (ai && typeof ai.run === 'function') {
    try {
      const r = await ai.run('@cf/black-forest-labs/flux-1-schnell', { prompt: String(prompt).slice(0, 2000), steps: 4 });
      if (r && r.image) return { ok: true, url: `data:image/jpeg;base64,${r.image}`, revised_prompt: prompt, modelo: 'FLUX schnell (Workers AI)' };
    } catch (e) { console.warn('[CORTEX] FLUX falhou:', e && e.message); }
  }
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { ok: false, error: 'não consegui criar a imagem agora. Tente de novo em instantes.' };
  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', { method: 'POST', headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'dall-e-3', prompt, n: 1, size: '1024x1024', style: style === 'artistic' ? 'vivid' : 'natural', response_format: 'url' }) });
    if (!res.ok) throw new Error(`DALL-E ${res.status}: ${await res.text()}`);
    const d = await res.json();
    return { ok: true, url: d.data[0].url, revised_prompt: d.data[0].revised_prompt };
  } catch (e) { return { ok: false, error: 'Internal error' }; }
}

// ═══ SWARM ════════════════════════════════════════════════════════════
async function runSwarm(agentNames, messages, dynAgents) {
  const all = { ...STATIC_AGENTS, ...dynAgents };
  const names = agentNames.filter(n => all[n]);
  if (!names.length) names.push('business');
  const results = await Promise.allSettled(names.map(async name => {
    const agent = all[name];
    const mk = name === 'dev' ? 'groq_deepseek_r1' : name === 'finance' ? 'groq_llama4_maverick' : 'groq_llama4_scout';
    const { text: reply } = await callChain(agent.system, messages, chain(mk), 3000);
    return { name, reply, ok: true };
  }));
  const outputs = results.map((r, i) => ({ name: names[i], reply: r.status === 'fulfilled' ? r.value.reply : `[${names[i]} indisponível]`, ok: r.status === 'fulfilled' }));
  if (outputs.filter(o => o.ok).length > 1) {
    const summaryInput = outputs.map(o => `### ${o.name.toUpperCase()}\n${o.reply}`).join('\n\n---\n\n');
    try {
      const { text: synthesis } = await callChain('Consolide as análises dos especialistas em uma resposta executiva, estruturada com markdown, em português do Brasil. Seja direto e acionável.', [{ role: 'user', content: summaryInput }], chain('groq_llama3'), 4000);;
      return { outputs, synthesis };
    } catch { }
  }
  return { outputs, synthesis: outputs[0]?.reply || '' };
}

// ═══ PARSER ═══════════════════════════════════════════════════════════
function safeJSON(t) { try { return JSON.parse(t); } catch { return null; } }
function extractJSON(t) { const m = t.match(/\{[\s\S]*\}/); return m ? m[0] : null; }
async function parseOrchestrator(raw) {
  let d = safeJSON(raw); if (d) return { decision: d, layer: 1 };
  const ex = extractJSON(raw); if (ex) { d = safeJSON(ex); if (d) return { decision: d, layer: 2 }; }
  try { const { text: rep } = await callChain('Retorne SOMENTE JSON válido. Zero texto fora do JSON.', [{ role: 'user', content: raw }], chain('groq_llama3_fast', 'gemini_25_flash'), 600); d = safeJSON(rep) || safeJSON(extractJSON(rep) || ''); if (d) return { decision: d, layer: 3 }; } catch { }
  return { decision: { type: 'chat', intent: 'chat', response: raw }, layer: 'fallback' };
}

// ═══ USAGE ════════════════════════════════════════════════════════════
async function checkAndTrackUsage(tenantId, userId) {
  // SECURITY: Firebase offline → fail-closed (free), NUNCA unlimited
  if (!db) return { ok: true, unlimited: false, plan: 'free', calls: 0, limit: PLAN_LIMITS.free };
  const today = new Date().toISOString().split('T')[0];
  try {
    const tenantDoc = await db.collection('tenants').doc(tenantId).get().catch(() => null);
    const plan = tenantDoc?.exists ? (tenantDoc.data().plan || 'free') : 'free';
    const limit = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
    const ref = db.collection('tenants').doc(tenantId).collection('usage').doc(today);
    const inc = { cortexCalls: admin.firestore.FieldValue.increment(1), [`userBreakdown.${userId}`]: admin.firestore.FieldValue.increment(1) };
    if (limit === -1) {
      const doc = await ref.get();
      if (!doc.exists) await ref.set({ date: today, cortexCalls: 1, tenantId, plan, userBreakdown: { [userId]: 1 } });
      else await ref.update(inc).catch(() => {});
      return { ok: true, unlimited: true, plan, calls: 0, limit: -1 };
    }
    return await db.runTransaction(async tx => {
      const doc = await tx.get(ref);
      if (!doc.exists) { tx.set(ref, { date: today, cortexCalls: 1, tenantId, plan, userBreakdown: { [userId]: 1 } }); return { ok: true, calls: 1, limit, plan }; }
      const calls = (doc.data().cortexCalls || 0) + 1;
      if (calls > limit) return { ok: false, error: `Limite diário do plano **${plan}** atingido (${limit} msgs/dia).\n\nFaça upgrade em **Configurações → Assinatura**.`, calls: doc.data().cortexCalls, limit, plan };
      tx.update(ref, inc);
      return { ok: true, calls, limit, plan };
    });
  } catch (e) { console.warn('[CORTEX] Usage:', 'Internal error'); return { ok: true, plan: 'unknown', calls: 0, limit: -1 }; }
}

function buildSystemPrompt(tenantId, plan, ragCtx, learningCtx) {
  const dataHoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  // NEXIA: acesso sempre ILIMITADO, sem restrição de tamanho ou tokens
  return `Você é o Cortex, um assistente de inteligência artificial que ajuda em qualquer assunto: perguntas, escrita, estudo, contas, código, negócios e pesquisa. Não cite o NEXIA OS a menos que a pessoa pergunte.\n\nTENANT: ${tenantId} | PLANO: ${plan.toUpperCase()} | ACESSO: 🔓 ILIMITADO | DATA DE HOJE (BRT): ${dataHoje} | HORA BRT: ${now}\n\n## CAPACIDADES (use quando a pessoa pedir):\n- **Estratégia e Negócios**: SaaS, MRR, churn, pricing, vendas, marketing, valuation\n- **Desenvolvimento**: Firebase, Netlify Functions, JS/TS, React, Python — código COMPLETO\n- **Segurança**: OWASP, LGPD, Firebase Rules, pentest, auditoria\n- **CRM**: Criar tarefas, contatos, reuniões, lançamentos financeiros\n- **Jurídico**: Contratos, LGPD, editais de leilão, compliance\n- **Análise Financeira**: DRE, fluxo de caixa, precificação, projeções\n\n## REGRAS ABSOLUTAS:\n- Responda no mesmo idioma da última mensagem da pessoa (português do Brasil quando ela escrever em português)\n- Respostas curtas para perguntas simples; completas quando a pessoa pedir detalhes\n- Use a data de hoje (${dataHoje}) como referência temporal atual. NUNCA diga que seu conhecimento termina em datas passadas (como 2024).\n- Use markdown rico (tabelas, código, listas) em respostas técnicas\n- Forneça código COMPLETO e INTEGRAL — NUNCA truncado, NUNCA use "..." para omitir\n- Seja direto e acionável — sem rodeios\n\n${DECISOES_DONO}\n${learningCtx ? `\n## CONTEXTO DO USUÁRIO:\n${learningCtx}\n` : ''}${ragCtx ? `\n## DOCUMENTOS DE REFERÊNCIA:\n${ragCtx}\n` : ''}`;
}

async function cxLog(tenantId, userId, data) {
  if (!db) return;
  try { await db.collection('tenants').doc(tenantId).collection('cortex_logs').add({ ttl: admin.firestore.Timestamp.fromMillis(Date.now() + 2592000000), userId, ...data, ts: admin.firestore.FieldValue.serverTimestamp() }); } catch { }
}

// ═══════════════════════════════════════════════════════════════════════
//  HANDLER PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════
exports.handler = async (event, ctx) => {
  const headers = makeHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };

  const guardErr = await guard(event, 'cortex-chat');
  if (guardErr) return guardErr;

  const start = Date.now();
  try {
    let body = {};
    try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON inválido no body' }) }; }

    const { message: rawMessage, tenantId = 'nexia', ragEnabled = false, model = 'auto', conversationId = 'default', stream = true, image_request, maxTokens = 0, anexos, attachments } = body;
    const listaAnexos = anexos || attachments || [];

    // FIX IDOR: userId SEMPRE do token verificado — nunca do body
    const userId = event._uid || body.userId;
    if (!rawMessage) return { statusCode: 400, headers, body: JSON.stringify({ error: 'message é obrigatório' }) };
    const effectiveUserId = userId || 'anon';

    let message;
    try { message = sanitizePrompt(rawMessage); }
    catch (se) { return { statusCode: 400, headers, body: JSON.stringify({ error: se.message }) }; }

    const usage = await checkAndTrackUsage(tenantId, effectiveUserId);
    if (!usage.ok) return { statusCode: 429, headers, body: JSON.stringify({ error: usage.error, plan: usage.plan, limit: usage.limit, calls: usage.calls }) };

    if (image_request?.prompt) {
      const r = await generateImage(image_request.prompt, image_request.style);
      return { statusCode: 200, headers, body: JSON.stringify({ type: 'image', ...r }) };
    }
    if (stream && PEDE_IMAGEM.test(message)) {
      const r = await generateImage(message, 'artistic');
      const txt = r.ok ? `![Imagem criada pelo Cortex](${r.url})` : `❌ ${r.error}`;
      const sse = o => `data: ${JSON.stringify(o)}\n\n`;
      async function* imagem() { yield sse({ token: txt, done: false }); yield sse({ done: true, model: r.modelo || 'imagem', intent: 'image' }); yield 'data: [DONE]\n\n'; }
      return { statusCode: 200, headers: SSE_HEADERS, stream: imagem() };
    }

    let mem = { history: [], summaries: [], entities: {} };
    try { mem = await memModule.load(effectiveUserId, tenantId, conversationId); } catch { }
    const rawContext = typeof memModule.buildContext === 'function' ? memModule.buildContext(mem.history, mem.summaries, 30) : (mem.history || []).slice(-30);

    const optResult = await otimizarHistorico(rawContext, { budgetTokens: maxTokens || 2000, keepRecent: 4 });
    const context = optResult.messages;
    const tokensBefore = optResult.tokensBefore + estimarTokens(message);
    const tokensAfter = optResult.tokensAfter + estimarTokens(message);

    const learningCtx = await learnModule.buildLearningContext(tenantId, message).catch(() => null);
    let ragCtx = '';
    if (ragEnabled) { try { ragCtx = await ragModule.buildRAGContext(tenantId, message) || ''; } catch { } }
    // #831: modo escolhido no composer (#1656).
    const modo = modos.modoValido(body.modo);
    let buscaDiag;
    if (modo && modos.MODOS[modo].web) { try { const b = await modos.buscarWebDetalhe(rawMessage); const w = b.contexto; buscaDiag = b.porFonte; if (w) ragCtx = ragCtx ? `${ragCtx}\n\n${w}` : w; } catch { } }

    let messageWithMultimodal = message;
    if (listaAnexos.length > 0) {
      try {
        const { processarMultimodal } = require('../../nexia-ai/cortex/multimodal');
        const envObj = { GEMINI_API_KEY: process.env.GEMINI_API_KEY, CLOUDFLARE_AI_TOKEN: process.env.CLOUDFLARE_AI_TOKEN, CLOUDFLARE_AI_ACCOUNT_ID: process.env.CLOUDFLARE_AI_ACCOUNT_ID };
        const mmResult = await processarMultimodal({ env: envObj, mensagem: message, anexos: listaAnexos });
        if (mmResult && mmResult.ok && mmResult.resposta) {
          messageWithMultimodal = `${message}\n\n[Análise Multimodal / Anexos Correlacionados (${mmResult.provedor}):]\n${mmResult.resposta}`;
        }
      } catch (mmErr) {
        console.warn('[CORTEX] Erro no processamento multimodal:', mmErr.message);
      }
    }

    const fullCtx = [...context, { role: 'user', content: messageWithMultimodal }];

    // NEXIA AI (Fase 4): com projeto em jogo, resolve o projeto e traz o contexto do Vault.
    // Sem projeto em jogo (ou sem acesso ao Vault), o fluxo abaixo segue igual ao anterior.
    let projectCtx = { mode: 'none' };
    try {
      projectCtx = await nexiaCortex.resolveForChat({ db, uid: event._uid, role: event._role, tenantId: body.tenantId, message, projectId: body.projectId, conversationId });
    } catch (e) { console.warn('[CORTEX] NEXIA AI resolver indisponível:', e && e.code ? e.code : 'erro'); }
    if (projectCtx.mode === 'ask') {
      const clarification = { type: 'clarification', reply: projectCtx.question, candidates: projectCtx.candidates };
      if (stream) {
        return { statusCode: 200, headers: SSE_HEADERS, body: `data: ${JSON.stringify({ token: projectCtx.question, done: false })}\n\n`
          + `data: ${JSON.stringify({ done: true, intent: 'clarification', clarification })}\n\ndata: [DONE]\n\n` };
      }
      return { statusCode: 200, headers, body: JSON.stringify(clarification) };
    }

    let decision = { type: 'chat', intent: model !== 'auto' ? model : 'chat', response: '' };
    let layer = 0;
    if (modo) {
      decision.intent = modos.MODOS[modo].intent;   // escolha do dono: pula o passo do orquestrador (mais rápido)
    } else if (model === 'auto') {
      const dif = classificarDificuldade(message, { ragEnabled, code_request: body.code_request, image_request: body.image_request });
      if (dif === 'simples') {
        decision.intent = 'fast';
      } else {
        try {
          // Orchestrator com fallback multi-provider para perguntas complexas
          let orchRaw = null;
          const orchModels = chain('groq_llama3_fast', 'gemini_25_flash', 'deepseek_v3', 'groq_llama4_scout');
          for (const om of orchModels) {
            try {
              orchRaw = await callSync(STATIC_AGENTS.orchestrator.system, fullCtx.slice(-12), om, 600);
              if (orchRaw) break;
            } catch { }
          }
          if (orchRaw) {
            const p = await parseOrchestrator(orchRaw);
            decision = p.decision; layer = p.layer;
          } else {
            decision.intent = 'reasoning';
          }
        } catch (e) {
          console.warn('[CORTEX] Orchestrator:', 'Internal error');
          decision.intent = 'reasoning';
        }
      }
    } else { decision.intent = model; }

    if (process.env.NODE_ENV !== 'production') console.warn(`[CORTEX v16] type:${decision.type} intent:${decision.intent} tenant:${tenantId} plan:${usage.plan}`);

    let finalResponse = '', modelUsed = 'groq_llama4_scout', execActions = [], swarmOut = [];

    // 1. AÇÕES CRM
    if (Array.isArray(decision.actions) && decision.actions.length) {
      // FIX v20: guard resolve o role via validateTenant; se anon/offline mas userId presente, eleva para 'member'
      const role = event._role || (userId && userId !== 'anon' ? 'member' : 'user');
      for (const act of decision.actions) {
        try {
          if (!act.type || !act.data) continue;
          validateAIAction(act.type, act.data);
          if (!checkPermission(role, act.type)) { execActions.push({ ok: false, action: act.type, error: 'Sem permissão' }); continue; }
          execActions.push(await actionModule.dispatch(act.type, act.data, tenantId, userId));
        } catch (e) { execActions.push({ ok: false, error: 'Internal error', action: act.type }); }
      }
      const lines = execActions.map(r => r.ok ? `✅ \`${r.action}\` executado` : `⚠️ \`${r.action || 'ação'}\` falhou: ${r.error}`).join('\n');
      finalResponse = (decision.response || '') + (lines ? '\n\n' + lines : '');
    }

    // 2. SWARM
    if (decision.type === 'swarm' && Array.isArray(decision.agents) && decision.agents.length) {
      let dynAgents = {};
      if (db) {
        try {
          const snap = await db.collection('agents').where('tenantId', '==', tenantId).where('active', '!=', false).get();
          snap.docs.forEach(d => { const x = d.data(); if (x.systemPrompt) dynAgents[d.id] = { system: x.systemPrompt }; });
        } catch { }
      }
      const sw = await runSwarm(decision.agents, fullCtx.slice(-10), dynAgents);
      swarmOut = sw.outputs;
      finalResponse = (decision.response ? decision.response + '\n\n' : '') + sw.synthesis;
      modelUsed = 'swarm-multi-agent';
    }

    // 3. AUTODEV
    if (!finalResponse.trim() && decision.type === 'code' && decision.code_request && autodevModule) {
      try {
        const r = await autodevModule.handler({ httpMethod: 'POST', body: JSON.stringify(decision.code_request) });
        const b = JSON.parse(r.body);
        finalResponse = r.statusCode === 200 && b.ok ? b.generatedCode : `❌ AutoDev: ${b.error || 'Erro'}`;
        modelUsed = b.modelUsed ? `autodev-${b.modelUsed}` : 'autodev';
      } catch (e) { finalResponse = decision.response || `❌ Erro AutoDev: ${'Internal error'}`; }
    }

    // 4. IMAGEM
    if (!finalResponse.trim() && decision.type === 'image' && decision.image_request) {
      const r = await generateImage(decision.image_request.prompt, decision.image_request.style);
      finalResponse = r.ok ? `🖼️ **Imagem gerada!**\n\n${r.url}\n\n*Prompt: ${r.revised_prompt || decision.image_request.prompt}*` : `❌ Erro imagem: ${r.error}`;
      modelUsed = r.modelo || 'imagem';
    }

    // 5. CHAT COM STREAMING
    if (!finalResponse.trim()) {
      const intentKey = decision.model_override || decision.intent || model || 'auto';
      const wanted = (intentKey === 'auto') ? 'groq_llama4_scout' : (INTENT_ROUTER[intentKey] || intentKey);
      const keys = chain(wanted, 'deepseek_v3', 'groq_llama3');
      const resolvedKey = keys[0] || wanted;
      const ai = AI_CATALOG[resolvedKey] || AI_CATALOG.groq_llama3;
      modelUsed = ai.label || ai.model;

      const systemPrompt = buildSystemPrompt(tenantId, usage.plan, ragCtx, learningCtx) + nexiaCortex.promptSection(projectCtx);
      // #2391: limite de tokens por modo (2000 para rápido, 6000 para normal)
      const TOKEN_LIMITS = { fast: 2000, normal: 6000 };
      const tokLimit = maxTokens || (modo && modos.MODOS[modo].maxTokens) || TOKEN_LIMITS[modo] || TOKEN_LIMITS.normal;
      const historyLen = (Array.isArray(context) ? context.length : 0) || (mem && Array.isArray(mem.history) ? mem.history.length : 0);
      const elegivelCache = podeUsarCache(message, { historyLength: historyLen, projectMode: projectCtx ? projectCtx.mode : 'none', learningCtx, ragEnabled });

      if (stream) {
        // NEXIA AI (Fase 5): streaming real. Cada token vai para o cliente assim que o
        // provedor o entrega (server.js escreve o `stream` em `res`). A troca de provedor
        // só acontece antes do primeiro token, como no laço de fallback anterior.
        const order = (keys.length ? keys : [resolvedKey]).map(descOf);
        const abort = new AbortController();
        const sse = o => `data: ${JSON.stringify(o)}\n\n`;
        async function* events() {
          let fullText = '';
          let used = modelUsed;
          try {
            try {
              for await (const ev of modelRouter.getRouter().streamWithFallback(order, { system: systemPrompt, messages: fullCtx.slice(-30), maxTokens: tokLimit, cache: elegivelCache, signal: abort.signal })) {
                if (ev.type === 'model') {
                  used = labelOf(ev.provider, ev.model);
                  if (ev.attempts.length) console.warn('[CORTEX] Providers indisponíveis antes do stream:', ev.attempts.map(x => `${x.provider}:${x.code}`).join(', '));
                } else if (ev.type === 'text') {
                  fullText += ev.text;
                  yield sse({ token: ev.text, done: false });
                } else if (ev.type === 'error') {
                  console.warn('[CORTEX] Stream interrompido:', ev.code);
                  yield sse({ token: '\n\n❌ A resposta foi interrompida. Tente novamente.', done: false });
                }
              }
            } catch (e) {
              if (e && e.code === 'ABORTED') return;
              // Nenhum streaming funcionou: chamada completa como último recurso (igual ao anterior)
              let fallbackText = '';
              let usedFb = 'fallback';
              try { fallbackText = (await callChain(systemPrompt, fullCtx.slice(-15), keys, 4096)).text; } catch { }
              if (!fallbackText) { const rw = await reservaWorkersAI(systemPrompt, fullCtx.slice(-15)); if (rw) { fallbackText = rw.text; usedFb = rw.modelo; } }
              if (fallbackText && typeof memModule.save === 'function') await memModule.save(effectiveUserId, [...(mem.history || []), { role: 'user', content: message }, { role: 'assistant', content: fallbackText }], mem.summaries, tenantId, {}, conversationId).catch(() => {});
              if (!fallbackText) fallbackText = '❌ Todas as IAs estão indisponíveis. Verifique as API keys nos segredos do Worker (Cloudflare).';
              yield sse({ token: fallbackText, done: false });
              yield sse({ done: true, model: usedFb, ...(buscaDiag ? { busca: buscaDiag } : {}) });
              yield 'data: [DONE]\n\n';
              return;
            }
            // #1657: grava a memória ANTES do "done". O app para de ler no "done", e o código depois dele nunca rodava,
            // então a conversa não era salva e o Cortex esquecia o que a pessoa tinha dito.
            const nm = [{ role: 'user', content: message }, { role: 'assistant', content: fullText }];
            if (typeof memModule.save === 'function') ctx.waitUntil(memModule.save(effectiveUserId, [...(mem.history || []), ...nm], mem.summaries, tenantId, memModule.extractEntities ? memModule.extractEntities(nm, mem.entities) : {}, conversationId).catch(() => {}));
            cxLog(tenantId, userId, { type: 'cortex_execution', conversationId, intent: decision.type, layer, ms: Date.now() - start, modelUsed: used, stream: true, plan: usage.plan, tokensBefore, tokensAfter }).catch(() => {});
            yield sse({ done: true, model: used, ...(buscaDiag ? { busca: buscaDiag } : {}), intent: decision.type, actions: execActions, swarm: swarmOut, usage: { calls: usage.calls, limit: usage.limit, unlimited: !!usage.unlimited, tokensBefore, tokensAfter }, ...(projectCtx.mode === 'context' ? { project: { project_id: projectCtx.project.project_id, confidence: projectCtx.project.confidence } } : {}) });
            yield 'data: [DONE]\n\n';
          } finally {
            abort.abort();
          }
        }
        return { statusCode: 200, headers: SSE_HEADERS, stream: events() };
      } else {
        try {
          const r = await callChain(systemPrompt, fullCtx.slice(-30), keys, tokLimit);
          finalResponse = r.text;
          modelUsed = (AI_CATALOG[r.key] && AI_CATALOG[r.key].label) || r.key;
        } catch (e) {
          console.warn('[CORTEX] Nenhuma IA respondeu:', e && (e.code || e.message));
          const rw = await reservaWorkersAI(systemPrompt, fullCtx.slice(-15));
          if (rw) { finalResponse = rw.text; modelUsed = rw.modelo; } else finalResponse = keys.length ? '❌ As IAs configuradas não responderam agora. Tente de novo em instantes.' : '❌ Nenhuma IA configurada. Cadastre GEMINI_API_KEY (grátis) nos segredos do repositório e publique de novo.';
        }
      }
    }

    const nm = [{ role: 'user', content: message }, { role: 'assistant', content: finalResponse }];
    if (typeof memModule.save === 'function') ctx.waitUntil(memModule.save(userId, [...(mem.history || []), ...nm], mem.summaries, tenantId, {}, conversationId).catch(() => {}));
    if (typeof learnModule.saveExample === 'function') learnModule.saveExample(tenantId, userId, message, finalResponse, decision.type, conversationId).catch(() => {});
    await cxLog(tenantId, userId, { type: 'cortex_execution', conversationId, intent: decision.type, layer, ms: Date.now() - start, actionsCount: execActions.length, modelUsed, plan: usage.plan, tokensBefore, tokensAfter }).catch(() => {});

    return {
      statusCode: 200, headers,
      body: JSON.stringify({ reply: finalResponse, type: decision.type, intent: decision.intent, actions: execActions, swarm: swarmOut, _meta: { layer, ms: Date.now() - start, modelUsed, version: 'v16.0', conversationId, plan: usage.plan, unlimited: !!usage.unlimited, usage: { calls: usage.calls, limit: usage.limit, tokensBefore, tokensAfter }, ...(projectCtx.mode === 'context' ? { project: { project_id: projectCtx.project.project_id, confidence: projectCtx.project.confidence } } : {}) } })
    };

  } catch (err) {
    const status = err.message?.includes('Limite') ? 429 : err.message?.includes('não permitid') ? 403 : 500;
    // SEC Fase 1 (A5): detalhe só no log; cliente recebe mensagem segura + correlationId
    const body = publicErrorBody('CORTEX v16', err, status === 429 ? 'Limite atingido.' : status === 403 ? 'Operação não permitida.' : 'Erro interno. Tente novamente.');
    return { statusCode: status, headers, body: JSON.stringify(body) };
  }
};exports.AI_CATALOG = AI_CATALOG; exports.chain = chain; // NEXIA AI (Fase 5): teste de cobertura do catálogo pelo Model Router

// #1640: usados nos testes.
exports.PEDE_IMAGEM = PEDE_IMAGEM;
exports.generateImage = generateImage;
exports.reservaWorkersAI = reservaWorkersAI;
