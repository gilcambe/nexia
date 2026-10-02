'use strict';
// Filtros do GitHub Adapter: arquivos que o NEXIA nunca lê nem escreve e valores com
// forma de secret. Para código, só detectores de formato conhecido (prefixos de chave,
// PEM, JWT, URL com senha): os heurísticos do Vault (hex longo, entropia, "password=")
// dariam falso positivo em lockfiles, hashes e código comum.
const { DETECTORS } = require('../vault/secrets');

const SENSITIVE_NAME = [
  /^\.env(\..+)?$/i, /^\.envrc$/i, /^\.npmrc$/i, /^\.pypirc$/i, /^\.netrc$/i, /^\.git-credentials$/i,
  /\.(pem|key|p12|pfx|jks|keystore|ppk|asc|gpg)$/i, /^id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/i,
  /^credentials(\.json)?$/i, /service[-_]?account.*\.json$/i, /firebase-adminsdk.*\.json$/i, /^secrets?\.(json|ya?ml|toml)$/i,
  /\.tfstate(\.backup)?$/i, /^\.dev\.vars$/i,
];
const EXAMPLE = /\.(example|sample|template|dist)$/i;

function isSensitivePath(p) {
  const base = String(p).split('/').pop();
  if (EXAMPLE.test(base)) return false;
  return SENSITIVE_NAME.some(re => re.test(base));
}

const SKIP = new Set(['long_hex', 'secret_assignment']);
const FORMAT_DETECTORS = DETECTORS.filter(([name]) => !SKIP.has(name));

function findSecrets(text) {
  if (typeof text !== 'string' || !text) return [];
  return FORMAT_DETECTORS.filter(([, re]) => re.test(text)).map(([name]) => name);
}

function redactSecrets(text) {
  let count = 0;
  let out = String(text);
  for (const [, re] of FORMAT_DETECTORS) {
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
    out = out.replace(g, () => { count++; return '[REDACTED]'; });
  }
  return { text: out, count };
}

module.exports = { isSensitivePath, findSecrets, redactSecrets };
