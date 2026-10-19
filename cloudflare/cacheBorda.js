'use strict';
// Cache de borda (#807) com a Cache API do Worker (grátis). Só leituras públicas: GET, sem
// Authorization, sem cookie de sessão, resposta 200. Tempo por rota (60 a 300 s). Menos chamadas
// ao Firestore/Google e resposta mais rápida. Desliga com NEXIA_CACHE_BORDA=0 (variável no painel).
// Obs.: em *.workers.dev a Cache API não guarda nada (o Cloudflare ignora); nos domínios próprios
// (Kernex) funciona. Em qualquer caso o pedido segue normal.

// Rota → segundos. Só rotas cuja resposta é igual para qualquer visitante do mesmo endereço.
const ROTAS = {
  '/api/firebase-config': 300,
  '/.well-known/assetlinks.json': 300,
};

function ttlDe(request, env) {
  if (String((env && env.NEXIA_CACHE_BORDA) || '').trim() === '0') return 0;
  if (request.method !== 'GET') return 0;
  if (request.headers.get('authorization') || request.headers.get('cookie')) return 0;
  const path = new URL(request.url).pathname.replace(/\/+$/, '') || '/';
  return ROTAS[path] || 0;
}

// A resposta de /api/firebase-config muda com o cabeçalho X-Nexia-Proxy (authDomain): entra na chave.
function chaveDe(request) {
  const u = new URL(request.url);
  u.searchParams.set('__px', request.headers.get('x-nexia-proxy') ? '1' : '0');
  return new Request(u.toString(), { method: 'GET' });
}

/**
 * @param {Request} request
 * @param {any} env
 * @param {{ waitUntil?: (p: Promise<any>) => void } | undefined} ctx
 * @param {() => Promise<Response>} produzir
 * @param {{ match: Function, put: Function } | undefined} cache  padrão: caches.default
 */
async function comCacheDeBorda(request, env, ctx, produzir, cache) {
  const ttl = ttlDe(request, env);
  const c = cache || (typeof caches !== 'undefined' && caches && /** @type {any} */ (caches).default);
  if (!ttl || !c) return produzir();
  const chave = chaveDe(request);
  try {
    const salvo = await c.match(chave);
    if (salvo) {
      const h = new Headers(salvo.headers);
      h.set('X-Nexia-Cache', 'HIT');
      return new Response(salvo.body, { status: salvo.status, headers: h });
    }
  } catch { /* cache fora do ar: segue sem ele */ }
  const resp = await produzir();
  if (resp.status !== 200) return resp;
  const h = new Headers(resp.headers);
  h.set('Cache-Control', `public, max-age=${ttl}`);
  h.set('X-Nexia-Cache', 'MISS');
  const final = new Response(resp.body, { status: 200, headers: h });
  const p = Promise.resolve().then(() => c.put(chave, final.clone())).catch(() => {});
  if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(p); else await p;
  return final;
}

module.exports = { comCacheDeBorda, ttlDe, chaveDe, ROTAS };
