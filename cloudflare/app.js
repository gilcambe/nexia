'use strict';
// NEXIA no Cloudflare Worker grátis (ADR-FREE-01). Faz o papel do server.js:
//  - /health e /api/firebase-config;
//  - /api/* e /.netlify/functions/* → handlers no formato Netlify (mesmo código do server.js);
//  - estáticos (site React em out/ e pastas públicas do legado) pelo binding ASSETS, com as
//    mesmas regras: só GET/HEAD, caminho normalizado, páginas dos tenants e SPA fallback.
// Sem fs, sem processo longo: tudo por pedido. Testado no Node (tests/unit/cloudflare-host.test.js).

const { normalizeRequestPath } = require('../lib/safe-path');
const { publicErrorBody } = require('../lib/safe-error');
const { isStreamResult } = require('../lib/stream-response');
const { TENANT_PAGES, resolveFunctionName } = require('../lib/routes');

const MAX_BODY_SIZE = 1 * 1024 * 1024;
const VERSION = '60.0.0';

function corsOrigin(env, headers) {
  const allowed = String(env.NEXIA_APP_URL || '').split(',').map(u => u.trim()).filter(Boolean);
  if (!allowed.length) return '';
  const origin = headers.get('origin') || '';
  return allowed.includes(origin) ? origin : allowed[0];
}

const json = (status, body, headers = {}) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff', ...headers },
});

const notFound = (status = 404) => json(status, { error: status === 405 ? 'Method Not Allowed' : status === 400 ? 'Bad Request' : 'Not Found' });

/** Copia os textos de env (vars e secrets do Worker) para process.env, que o código legado lê. */
function populateProcessEnv(env) {
  if (typeof process === 'undefined' || !process.env) return;
  for (const [k, v] of Object.entries(env || {})) {
    if (typeof v === 'string' && /^[A-Z_][A-Z0-9_]*$/.test(k) && process.env[k] !== v) process.env[k] = v;
  }
  // Padrão produção (no `wrangler dev`, NODE_ENV=development vem do .dev.vars). Chave em variável
  // porque o build do wrangler troca `process.env.NODE_ENV` escrito por extenso por uma constante.
  const NODE_ENV = 'NODE_ENV';
  if (!process.env[NODE_ENV]) process.env[NODE_ENV] = 'production';
}

async function readBody(request) {
  if (request.method === 'GET' || request.method === 'HEAD') return { body: null };
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > MAX_BODY_SIZE) return { tooLarge: true };
  const buf = new Uint8Array(await request.arrayBuffer());
  if (buf.byteLength > MAX_BODY_SIZE) return { tooLarge: true };
  return { body: buf.byteLength ? new TextDecoder().decode(buf) : null };
}

function toEvent(request, url, body) {
  const headers = {};
  request.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
  const query = {};
  url.searchParams.forEach((v, k) => { query[k] = v; });
  return { httpMethod: request.method, path: url.pathname, queryStringParameters: query, headers, body, isBase64Encoded: false };
}

function streamBody(iterable) {
  const it = iterable[Symbol.asyncIterator]();
  const enc = new TextEncoder();
  return new ReadableStream({
    async pull(controller) {
      try {
        const n = await it.next();
        if (n.done) return controller.close();
        if (n.value === undefined || n.value === null || n.value === '') return;
        controller.enqueue(typeof n.value === 'string' ? enc.encode(n.value) : n.value);
      } catch (e) {
        console.warn('[STREAM] interrompido:', e && e.code ? e.code : 'erro');
        controller.close();
      }
    },
    cancel() { if (typeof it.return === 'function') return Promise.resolve(it.return()).catch(() => {}); },
  });
}

async function runFunction(fnName, request, url, env, getFunction) {
  const origin = corsOrigin(env, request.headers);
  const fn = fnName ? getFunction(fnName) : null;
  if (!fn || typeof fn.handler !== 'function') {
    return json(404, { error: 'Function não encontrada: ' + fnName }, { 'Access-Control-Allow-Origin': origin });
  }
  const { body, tooLarge } = await readBody(request);
  if (tooLarge) return json(413, { error: 'Payload muito grande.' });
  const baseHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Tenant-Id',
  };
  try {
    const result = await fn.handler(toEvent(request, url, body), {});
    const headers = { ...baseHeaders, ...((result && result.headers) || {}) };
    if (isStreamResult(result)) {
      return new Response(streamBody(result.stream), { status: result.statusCode || 200, headers: { ...headers, 'X-Accel-Buffering': 'no' } });
    }
    const status = (result && result.statusCode) || 200;
    const payload = result && result.body ? (result.isBase64Encoded ? Buffer.from(result.body, 'base64') : result.body) : null;
    return new Response(status === 204 || status === 304 ? null : payload, { status, headers });
  } catch (e) {
    return json(500, publicErrorBody('FN ' + fnName, e), { 'Access-Control-Allow-Origin': origin });
  }
}

function firebaseConfig(env) {
  if (!env.FIREBASE_API_KEY) {
    return json(503, { error: 'Firebase config unavailable. Cadastre FIREBASE_API_KEY nos segredos do repositório no GitHub e rode o Deploy Cloudflare de novo.' }, { 'Access-Control-Allow-Origin': '*' });
  }
  return json(200, {
    apiKey: env.FIREBASE_API_KEY,
    authDomain: env.FIREBASE_AUTH_DOMAIN || '',
    projectId: env.FIREBASE_PROJECT_ID || '',
    storageBucket: env.FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID || '',
    appId: env.FIREBASE_APP_ID || '',
  }, { 'Cache-Control': 'public, max-age=300', 'Access-Control-Allow-Origin': '*' });
}

const extOf = p => { const m = /\.[^./]+$/.exec(p); return m ? m[0].toLowerCase() : ''; };

async function fromAssets(assets, url, path, method) {
  const r = await assets.fetch(new Request(new URL(path, url.origin), { method: method === 'HEAD' ? 'HEAD' : 'GET' }));
  if (r.status !== 200) return null;
  const headers = new Headers(r.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  const cacheable = ['.css', '.woff2', '.svg', '.png', '.jpg', '.ico', '.woff', '.ttf', '.webp', '.js'].includes(extOf(path));
  headers.set('Cache-Control', cacheable && /\/assets\//.test(path) ? 'public, max-age=31536000, immutable' : 'no-cache');
  return new Response(r.body, { status: 200, headers });
}

async function serveStatic(request, url, env) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return notFound(405);
  const safePath = normalizeRequestPath(url.pathname || '/');
  if (safePath === null) return notFound(400);
  const assets = env.ASSETS;
  if (!assets) return notFound(404);

  const mapped = TENANT_PAGES[safePath.replace(/\/$/, '')];
  if (mapped) {
    const r = await fromAssets(assets, url, `/${mapped[0]}/${mapped[1]}`, request.method);
    if (r) return r;
  }
  if (safePath !== '/') {
    const r = await fromAssets(assets, url, safePath, request.method);
    if (r) return r;
  }
  // Caminho com extensão que não existe → 404 (sem SPA fallback); .html legado cai no SPA.
  const ext = extOf(safePath);
  if (ext && ext !== '.html') return notFound(404);
  const index = await fromAssets(assets, url, '/index.html', request.method);
  return index || notFound(404);
}

/**
 * @param {Request} request
 * @param {Record<string, any>} env  vars, secrets e o binding ASSETS do Worker
 * @param {{ getFunction: (name: string) => any }} deps
 */
async function handleRequest(request, env, { getFunction }) {
  populateProcessEnv(env);
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/\/+/g, '/').replace(/(.+)\/$/, '$1') || '/';

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: {
      'Access-Control-Allow-Origin': corsOrigin(env, request.headers),
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Tenant-Id',
    } });
  }
  if (pathname === '/health') {
    return json(200, { status: 'ok', version: VERSION, runtime: 'cloudflare-worker', frontend: !!env.ASSETS, timestamp: new Date().toISOString() },
      { 'Access-Control-Allow-Origin': '*' });
  }
  if (pathname === '/api/firebase-config') return firebaseConfig(env);
  if (pathname.startsWith('/api/') || pathname.startsWith('/.netlify/functions/')) {
    return runFunction(resolveFunctionName(pathname), request, url, env, getFunction);
  }
  return serveStatic(request, url, env);
}

module.exports = { handleRequest, populateProcessEnv, toEvent, MAX_BODY_SIZE };
