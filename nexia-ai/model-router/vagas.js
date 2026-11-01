'use strict';
// #2716: vagas de IA da Central (Kernex → Conectar IAs). Cada segredo IA_VAGA_<n> (1 a 50) vale "provedor:chave".
// Antes, a fila recebia essas chaves mas nada lia: só a Reserva usava. Agora o roteador usa todas.
// - Provedor conhecido: a chave da vaga entra na variável do provedor (ex.: GROQ_API_KEY) quando ela está vazia.
//   Uma conta por provedor: não trocamos de conta para fugir do limite (regra do dono e termos dos sites).
// - "custom" (Outra IA compatível com OpenAI): vira o provedor vaga-<n> e entra primeiro na cadeia.
// Nunca registra a chave em log nem a devolve.

const MAX_VAGAS = 50;

// provedor da Central → variável que o roteador lê (nexia-ai/model-router/providers/*.js).
const ENV_DO_PROVEDOR = Object.freeze({
  gemini: 'GEMINI_API_KEY', groq: 'GROQ_API_KEY', openrouter: 'OPENROUTER_API_KEY', mistral: 'MISTRAL_API_KEY',
  cohere: 'COHERE_API_KEY', huggingface: 'HF_API_KEY', codestral: 'CODESTRAL_API_KEY', nvidia: 'NVIDIA_API_KEY',
  zai: 'ZAI_API_KEY', sambanova: 'SAMBANOVA_API_KEY', llm7: 'LLM7_API_KEY',
});

/** "custom:<base64url de {url,modelo,chave}>" → { url, modelo, chave } ou null. */
function lerCustom(resto) {
  try {
    const o = JSON.parse(Buffer.from(String(resto), 'base64url').toString('utf8'));
    const url = String(o.url || '').trim().replace(/\/+$/, '');
    const modelo = String(o.modelo || '').trim();
    const chave = String(o.chave || '').trim();
    if (!/^https:\/\/[^\s/]+(\/\S*)?$/.test(url) || !/^[A-Za-z0-9._:/-]{1,120}$/.test(modelo) || !chave) return null;
    return { url, modelo, chave };
  } catch { return null; }
}

/** Monta o valor guardado para uma vaga "Outra IA". */
function valorCustom({ url, modelo, chave }) {
  return 'custom:' + Buffer.from(JSON.stringify({ url, modelo, chave }), 'utf8').toString('base64url');
}

/** Todas as vagas preenchidas, em ordem de número. */
function lerVagas(env = process.env, estado = {}) {
  const out = [];
  for (let n = 1; n <= MAX_VAGAS; n++) {
    const v = String((env && env[`IA_VAGA_${n}`]) || '').trim();
    const i = v.indexOf(':');
    if (i < 1) continue;
    const provedor = v.slice(0, i);
    const resto = v.slice(i + 1);
    const vagaEstado = estado[n] || {};
    if (vagaEstado.pausada) continue;
    if (provedor === 'custom') { const c = lerCustom(resto); if (c) out.push({ n, provedor, ...c, ordem: vagaEstado.ordem || 0 }); continue; }
    if (ENV_DO_PROVEDOR[provedor] && resto) out.push({ n, provedor, chave: resto, ordem: vagaEstado.ordem || 0 });
  }
  return out.sort((a, b) => a.ordem - b.ordem);
}
  const out = [];
  for (let n = 1; n <= MAX_VAGAS; n++) {
    const v = String((env && env[`IA_VAGA_${n}`]) || '').trim();
    const i = v.indexOf(':');
    if (i < 1) continue;
    const provedor = v.slice(0, i);
    const resto = v.slice(i + 1);
    if (provedor === 'custom') { const c = lerCustom(resto); if (c) out.push({ n, provedor, ...c }); continue; }
    if (ENV_DO_PROVEDOR[provedor] && resto) out.push({ n, provedor, chave: resto });
  }
  return out;
}

/** Cópia do env com a chave da primeira vaga de cada provedor onde a variável dele está vazia. */
function aplicarVagas(env = process.env) {
  const vagas = lerVagas(env);
  if (!vagas.length) return env;
  const novo = { ...env };
  for (const v of vagas) {
    const nome = ENV_DO_PROVEDOR[v.provedor];
    if (nome && !novo[nome]) novo[nome] = v.chave;
  }
  return novo;
}

/** Vagas "Outra IA": { provider: 'vaga-N', model, chave, envKey, cfg } para o roteador. */
function vagasCustom(env = process.env) {
  return lerVagas(env).filter(v => v.provedor === 'custom').map(v => {
    const url = /\/chat\/completions$/.test(v.url) ? v.url : `${v.url}/chat/completions`;
    const envKey = `IA_VAGA_${v.n}_CHAVE`;
    return { provider: `vaga-${v.n}`, model: v.modelo, chave: v.chave, envKey, cfg: { url, env: envKey, max_output: 8192, tools: true } };
  });
}

module.exports = { MAX_VAGAS, ENV_DO_PROVEDOR, lerVagas, aplicarVagas, vagasCustom, lerCustom, valorCustom };
