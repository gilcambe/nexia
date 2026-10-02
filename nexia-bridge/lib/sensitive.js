'use strict';
// Arquivos que o Bridge nunca lê, nunca escreve e nunca manda ao modelo (spec §8:
// "Segredos em .env nunca devem ser enviados ao LLM"), e redação de valores com forma
// de secret em qualquer texto devolvido (conteúdo de arquivo, saída de comando, diff).
const path = require('path');
const { shannonEntropy } = require('../../nexia-ai/vault/secrets');

const SENSITIVE_NAME = [
  /^\.env$/i,
  /^\.env\.(?!example$|sample$|template$|dist$).+$/i,
  /\.(pem|key|p12|pfx|jks|keystore|ppk)$/i,
  /^id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/i,
  /service[-_]?account.*\.json$/i,
  /^\.npmrc$/i, /^\.pypirc$/i, /^\.netrc$/i, /^\.git-credentials$/i,
  /^credentials(\.json)?$/i,
  /^\.dev\.vars$/i, // Cloudflare Wrangler
];

/** true se o caminho (relativo ou absoluto) aponta para um arquivo sensível ou para dentro de .git. */
function isSensitive(p) {
  const parts = String(p).split(/[\\/]+/).filter(Boolean);
  if (parts.some(s => s.toLowerCase() === '.git')) return true;
  const base = parts[parts.length - 1] || '';
  return SENSITIVE_NAME.some(re => re.test(base));
}

/** Escrita em .git é bloqueada; leitura de .git também (objetos internos, config com credenciais). */
const insideGitDir = p => String(p).split(/[\\/]+/).some(s => s.toLowerCase() === '.git');

// Padrões globais para redação (mesmos detectores do Vault, aplicados por trecho).
const REDACT = [
  /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?(-----END [A-Z0-9 ]*PRIVATE KEY-----|$)/g,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
  /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
  /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/g,
  /\bglpat-[A-Za-z0-9_-]{20,}/g,
  /\bgsk_[A-Za-z0-9]{20,}/g,
  /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}/g,
  /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}/g,
  /\bxox[abposr]-[A-Za-z0-9-]{10,}/g,
  /\bAIza[0-9A-Za-z_-]{35}\b/g,
  /\bya29\.[0-9A-Za-z_-]{20,}/g,
  /\b(?:APP_USR|TEST)-\d{6,}-[0-9a-f-]{8,}/gi,
  /\bnpm_[A-Za-z0-9]{36}\b/g,
  /(\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:)[^\s@/]+(?=@)/gi,
  /(\b(?:password|passwd|pwd|senha|secret|token|api[_-]?key|access[_-]?key|client[_-]?secret|private[_-]?key)\s*[:=]\s*["']?)[^\s"']{6,}/gi,
];

function highEntropy(tok) {
  if (/^[0-9a-f]+$/i.test(tok) || /^[A-Za-z_/.-]+$/.test(tok)) return false;
  if (!/[A-Za-z]/.test(tok) || !/[0-9]/.test(tok)) return false;
  return shannonEntropy(tok) >= 4.2;
}

/** Substitui valores com forma de secret por [REDACTED]. Devolve { text, redactions }. */
function redact(text) {
  let s = String(text);
  let n = 0;
  for (const re of REDACT) {
    s = s.replace(re, (m, keep) => { n++; return typeof keep === 'string' && m.startsWith(keep) ? `${keep}[REDACTED]` : '[REDACTED]'; });
  }
  // Tokens longos de alta entropia que nenhum padrão pegou (hashes hex, como SHAs do git, ficam)
  s = s.replace(/[A-Za-z0-9_\-+/=]{32,}/g, tok => (highEntropy(tok) ? (n++, '[REDACTED]') : tok));
  return { text: s, redactions: n };
}

const SECRET_ENV = /(KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|PRIVATE|AUTH|SESSION|COOKIE|DSN)/i;

/** Ambiente para processos filhos: sem variáveis com cara de secret, salvo as liberadas no config. */
function childEnv(env, passEnv = []) {
  const out = {};
  for (const [k, v] of Object.entries(env)) {
    if (SECRET_ENV.test(k) && !passEnv.includes(k)) continue;
    out[k] = v;
  }
  return out;
}

module.exports = { isSensitive, insideGitDir, redact, childEnv, SENSITIVE_NAME, basename: p => path.basename(p) };
