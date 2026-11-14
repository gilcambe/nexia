'use strict';
// Groq aposenta nomes de modelo com o tempo (13/11/2026: "llama-3.3-70b-versatile" passou a dar 404 e calou o Marketing
// do Escritório e o Divulga). Quem chama o Groq direto usa este módulo: pega na lista da conta o primeiro modelo vivo
// da preferência e guarda por 1 hora. Modelos que "pensam" antes (gpt-oss, qwen3) ganham espaço extra de resposta.
const PREFERENCIA = [
  'llama-3.3-70b-versatile',
  'meta-llama/llama-4-maverick-17b-128e-instruct',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'moonshotai/kimi-k2-instruct-0905',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'llama-3.1-8b-instant',
];
const RESERVA = 'openai/gpt-oss-120b';
let guardado = null;

/** Escolhe o modelo a partir da lista de ids da conta (função pura, testável). */
function escolher(ids) {
  const vivos = new Set(ids || []);
  return PREFERENCIA.find((m) => vivos.has(m))
    || [...vivos].find((m) => /llama|gpt-oss|qwen|kimi/i.test(m) && !/guard|whisper|tts|prompt|vision|orpheus|playai/i.test(m))
    || RESERVA;
}

/** Modelo vivo do Groq para esta chave (1 consulta por hora). Nunca lança: sem rede, devolve a reserva. */
async function modeloGroq(chave, { fetchImpl = fetch, agora = Date.now() } = {}) {
  if (guardado && agora - guardado.quando < 36e5) return guardado.modelo;
  try {
    const r = await fetchImpl('https://api.groq.com/openai/v1/models', { headers: { Authorization: `Bearer ${chave}` } });
    if (!r.ok) return RESERVA;
    const j = await r.json();
    const modelo = escolher((j.data || []).filter((m) => m.active !== false).map((m) => m.id));
    guardado = { modelo, quando: agora };
    return modelo;
  } catch { return RESERVA; }
}

/** Campos extras do corpo do pedido para o modelo escolhido (modelos que pensam precisam de mais espaço). */
function extrasGroq(modelo, maxTokens) {
  if (/gpt-oss/i.test(modelo)) return { reasoning_effort: 'low', max_tokens: maxTokens + 400 };
  if (/qwen3/i.test(modelo)) return { max_tokens: maxTokens + 400 };
  return {};
}

/**
 * Chama o Groq com o modelo guardado (ou a reserva, que está vivo) numa única chamada; só se o Groq disser que o modelo
 * não existe mais (404/400) consulta a lista da conta e tenta 1 vez com o modelo vivo. `fazer(modelo)` devolve a Response.
 */
async function comGroq(chave, fazer, { fetchImpl = fetch } = {}) {
  const modelo = guardado ? guardado.modelo : RESERVA;
  const r = await fazer(modelo);
  if (!r || (r.status !== 404 && r.status !== 400)) return r;
  guardado = null;
  const novo = await modeloGroq(chave, { fetchImpl });
  return novo === modelo ? r : fazer(novo);
}

function limparCache() { guardado = null; }

module.exports = { comGroq, modeloGroq, extrasGroq, escolher, PREFERENCIA, RESERVA, limparCache };
