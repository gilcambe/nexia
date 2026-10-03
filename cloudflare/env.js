'use strict';
// NEXIA — hospedagem Cloudflare (ADR-HOST-01): o Worker repassa ao container só as variáveis de
// texto (vars e secrets do Worker). Bindings (Durable Objects, KV etc.) são objetos e ficam de fora.

const SKIP = new Set(['NEXIA_BACKEND']);

function containerEnv(env) {
  const out = {};
  for (const [k, v] of Object.entries(env || {})) {
    if (typeof v === 'string' && !SKIP.has(k) && /^[A-Z_][A-Z0-9_]*$/.test(k)) out[k] = v;
  }
  out.PORT = '8080';
  out.NODE_ENV = out.NODE_ENV || 'production';
  return out;
}

module.exports = { containerEnv };
