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

/** Pedido interno da retomada agendada (ADR-F12-03); null sem segredo forte configurado. */
function cronRequest(env) {
  const secret = env && env.NEXIA_CRON_SECRET;
  if (typeof secret !== 'string' || secret.length < 32) return null;
  return new Request('http://nexia.internal/api/nexia/internal/sweep', {
    method: 'POST', headers: { 'X-Nexia-Cron': secret, 'Content-Type': 'application/json' }, body: '{}',
  });
}

module.exports = { containerEnv, cronRequest };
