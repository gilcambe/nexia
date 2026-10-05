'use strict';
// Detecção de valores que parecem secrets (spec §15: "nunca gravar secrets no Vault").
// Aplicada a TODO texto gravado no Vault. O resultado cita só caminho e detector,
// nunca o valor.

const DETECTORS = [
  ['private_key_pem', /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/],
  ['service_account_json', /"type"\s*:\s*"service_account"|"private_key"\s*:/],
  ['jwt', /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/],
  ['aws_access_key', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['github_token', /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/],
  ['gitlab_token', /\bglpat-[A-Za-z0-9_-]{20,}/],
  ['groq_key', /\bgsk_[A-Za-z0-9]{20,}/],
  ['openai_anthropic_key', /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}/],
  ['stripe_key', /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}/],
  ['slack_token', /\bxox[abposr]-[A-Za-z0-9-]{10,}/],
  ['google_api_key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['google_oauth_token', /\bya29\.[0-9A-Za-z_-]{20,}/],
  ['mercadopago_token', /\b(?:APP_USR|TEST)-\d{6,}-[0-9a-f-]{8,}/i],
  ['npm_token', /\bnpm_[A-Za-z0-9]{36}\b/],
  ['url_with_credentials', /\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:[^\s@/]+@/i],
  // Hex longo fora de campo de hash/commit (esses são validados à parte e não passam por aqui)
  ['long_hex', /\b[0-9a-f]{40,}\b/i],
  ['secret_assignment', /\b(?:password|passwd|pwd|senha|secret|token|api[_-]?key|access[_-]?key|client[_-]?secret|private[_-]?key)\s*[:=]\s*["']?[^\s"']{6,}/i],
];

function shannonEntropy(s) {
  const freq = new Map();
  for (const ch of s) freq.set(ch, (freq.get(ch) || 0) + 1);
  let h = 0;
  for (const n of freq.values()) { const p = n / s.length; h -= p * Math.log2(p); }
  return h;
}

// Sequência longa, aleatória, com letras e dígitos: típica de token/chave.
function looksHighEntropy(token) {
  if (token.length < 32) return false;
  if (!/[A-Za-z]/.test(token) || !/[0-9]/.test(token)) return false;
  return shannonEntropy(token) >= 4.2;
}

/** Devolve a lista de detectores que casam com o texto (vazia se nenhum). */
function detectSecret(text) {
  if (typeof text !== 'string' || !text) return [];
  const hits = [];
  for (const [name, re] of DETECTORS) if (re.test(text)) hits.push(name);
  for (const tok of text.split(/[^A-Za-z0-9+/=_-]+/)) {
    if (looksHighEntropy(tok)) { hits.push('high_entropy'); break; }
  }
  return hits;
}

/**
 * Troca por "[redigido]" os trechos que parecem secrets. Para texto livre escrito por IA
 * (resumos de etapas), onde recusar a gravação inteira derrubaria a execução.
 */
function redactSecrets(text) {
  if (typeof text !== 'string' || !text) return text;
  let out = text;
  for (const [, re] of DETECTORS) out = out.replace(new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`), '[redigido]');
  return out.replace(/[A-Za-z0-9+/=_-]{32,}/g, tok => (looksHighEntropy(tok) ? '[redigido]' : tok));
}

module.exports = { detectSecret, redactSecrets, shannonEntropy, DETECTORS };
