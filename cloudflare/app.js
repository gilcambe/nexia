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
const { createTokenSource } = require('../lib/firebase-lite/google-auth');
const rid = require('../lib/rid');

const MAX_BODY_SIZE = 1 * 1024 * 1024;
const CORS_ABERTO = new Set(['/api/locacao', '/api/nutri']);
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
  // #1671: o binding do Workers AI não é texto, então não cabe em process.env; fica num global para os anexos.
  if (env && env.AI) globalThis.__NEXIA_AI__ = env.AI;
  // #2188: banco extra do Vault (Durable Object SQLite grátis), usado no rodízio depois do D1.
  if (env && env.COFRE_SQL) globalThis.__NEXIA_COFRE__ = env.COFRE_SQL;
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

async function runFunction(fnName, request, url, env, getFunction, reqId) {
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
    const ev = toEvent(request, url, body);
    if (reqId) ev.headers['x-request-id'] = reqId;
    const result = await fn.handler(ev, env);
    const headers = { ...baseHeaders, ...((result && result.headers) || {}) };
    if (isStreamResult(result)) {
      return new Response(streamBody(result.stream), { status: result.statusCode || 200, headers: { ...headers, 'X-Accel-Buffering': 'no' } });
    }
    const status = (result && result.statusCode) || 200;
    const payload = result && result.body ? (result.isBase64Encoded ? Buffer.from(result.body, 'base64') : result.body) : null;
    return new Response(status === 204 || status === 304 ? null : payload, { status, headers });
  } catch (e) {
    rid.logJson('error', 'função falhou', { rid: reqId, fn: fnName, erro: String((e && e.message) || e).slice(0, 300) });
    return json(500, { ...publicErrorBody('FN ' + fnName, e), rid: reqId }, { 'Access-Control-Allow-Origin': origin });
  }
}

// Sem os 6 FIREBASE_* do site, lê a configuração pública do app da Web direto do Firebase
// (Management API) com a própria chave de serviço; fica em memória enquanto o Worker vive.
// Assim o dono só precisa cadastrar a chave de serviço. Valores do site são públicos por natureza.
let webConfigCache = null;

async function webConfigFromServiceAccount(env, fetchImpl) {
  if (webConfigCache) return webConfigCache;
  const sa = JSON.parse(Buffer.from(String(env.FIREBASE_SERVICE_ACCOUNT_BASE64), 'base64').toString('utf8'));
  const token = await createTokenSource(sa, { fetchImpl }).getToken();
  const api = `https://firebase.googleapis.com/v1beta1/projects/${encodeURIComponent(sa.project_id)}`;
  const get = async (u) => {
    const r = await fetchImpl(u, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(`Firebase Management API ${r.status}`);
    return r.json();
  };
  const apps = (await get(`${api}/webApps`)).apps || [];
  const app = apps.find(a => a.state !== 'DELETED') || apps[0];
  if (!app) throw new Error('Projeto Firebase sem app da Web.');
  const c = await get(`${api}/webApps/${encodeURIComponent(app.appId)}/config`);
  if (!c.apiKey) throw new Error('Configuração do app da Web sem apiKey.');
  webConfigCache = {
    apiKey: c.apiKey, authDomain: c.authDomain || `${sa.project_id}.firebaseapp.com`, projectId: c.projectId || sa.project_id,
    storageBucket: c.storageBucket || '', messagingSenderId: c.messagingSenderId || '', appId: c.appId || app.appId,
  };
  return webConfigCache;
}

// Login do Google sem mostrar "firebaseapp.com": só quando FIREBASE_AUTH_PROXY_DOMAIN está definido e a chamada vem pelo domínio próprio (Pages).
// Domínios Kernex (#1013): com a variável KERNEX_AUTH_PROPRIO=1 no Worker, o pedido que chega por um host da lista
// usa o próprio host como authDomain (o /__/auth desse host já é repassado ao Firebase em proxyAuth).
// Sem a variável, nada muda. Ligar só depois de cadastrar os endereços no Firebase e no Google
// (passo a passo no PR do #1013). Para desfazer, apague a variável.
const KERNEX_HOSTS = ['kernex.com.br', 'bodycoach.kernex.com.br', 'cortex.kernex.com.br'];
function authDomainProprio(env, request) {
  if (!request) return '';
  if (String(env.KERNEX_AUTH_PROPRIO || '').trim() === '1') {
    let host = '';
    try { host = new URL(request.url).hostname.toLowerCase(); } catch { host = ''; }
    if (KERNEX_HOSTS.includes(host)) return host;
  }
  const dom = String(env.FIREBASE_AUTH_PROXY_DOMAIN || '').trim();
  if (!dom || !request.headers.get('X-Nexia-Proxy')) return '';
  return dom;
}

const AUTH_ORIGEM = 'https://nexia-c8710.firebaseapp.com';

async function proxyAuth(request, url, fetchImpl = (...a) => fetch(...a)) {
  const alvo = new URL(url.pathname + url.search, AUTH_ORIGEM);
  const headers = new Headers(request.headers);
  headers.delete('X-Nexia-Proxy'); headers.delete('host');
  const init = { method: request.method, headers, redirect: 'manual' };
  if (request.method !== 'GET' && request.method !== 'HEAD') init.body = request.body;
  return fetchImpl(alvo, init);
}

async function firebaseConfig(env, fetchImpl = (...a) => fetch(...a), request) {
  const cors = { 'Access-Control-Allow-Origin': '*' };
  if (!env.FIREBASE_API_KEY && env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    try {
      const c = { ...(await webConfigFromServiceAccount(env, fetchImpl)) };
      const proprio = authDomainProprio(env, request);
      if (proprio) c.authDomain = proprio;
      return json(200, c, { 'Cache-Control': 'public, max-age=300', ...cors });
    } catch (e) {
      console.error('[firebase-config] sem FIREBASE_API_KEY e a leitura automática falhou:', e && e.message);
    }
  }
  if (!env.FIREBASE_API_KEY) {
    return json(503, { error: 'Firebase config unavailable. Cadastre FIREBASE_API_KEY nos segredos do repositório no GitHub e rode o Deploy Cloudflare de novo.' }, cors);
  }
  return json(200, {
    apiKey: env.FIREBASE_API_KEY,
    authDomain: authDomainProprio(env, request) || env.FIREBASE_AUTH_DOMAIN || '',
    projectId: env.FIREBASE_PROJECT_ID || '',
    storageBucket: env.FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID || '',
    appId: env.FIREBASE_APP_ID || '',
  }, { 'Cache-Control': 'public, max-age=300', ...cors });
}

const _resetWebConfigCache = () => { webConfigCache = null; };

const BODY_COACH_PREFIX = '/body-coach';
// Domínios Kernex: cada subdomínio abre o próprio app na raiz (#1180). Caminhos antigos seguem iguais.
const HOME_POR_HOST = {
  'bodycoach.kernex.com.br': BODY_COACH_PREFIX + '/',
  'cortex.kernex.com.br': '/cortex',
};

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
  const home = HOME_POR_HOST[url.hostname];
  if (home && safePath === '/') return Response.redirect(url.origin + home + url.search, 302);
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
  // ADR-CLONE-02: NEXIA Body Coach é outro SPA, montado em /body-coach/ (apps/body-coach).
  // Rotas dele (ex.: /body-coach/workout) caem no index.html dele, não no do site principal.
  if (safePath === BODY_COACH_PREFIX || safePath.startsWith(BODY_COACH_PREFIX + '/')) {
    const novo = String(env.BODY_COACH_URL || '').replace(/\/$/, '');
    if (novo && !request.headers.get('X-Nexia-Proxy') && url.hostname.endsWith('.workers.dev')) {
      return Response.redirect(novo + safePath + url.search, 301);
    }
    const bc = await fromAssets(assets, url, BODY_COACH_PREFIX + '/index.html', request.method);
    return bc || notFound(404);
  }
  const index = await fromAssets(assets, url, '/index.html', request.method);
  return index || notFound(404);
}

/**
 * @param {Request} request
 * @param {Record<string, any>} env  vars, secrets e o binding ASSETS do Worker
 * @param {{ getFunction: (name: string) => any }} deps
 */
async function handleRequest(request, env, deps) {
  // #815: um rid por pedido, devolvido em X-Request-Id; erro 5xx vira log JSON e vai para "últimos erros" da Central.
  const reqId = rid.ridDe(request.headers.get('x-request-id'));
  let resp = await atender(request, env, deps, reqId);
  try { resp.headers.set('X-Request-Id', reqId); } catch {
    resp = new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers: new Headers(resp.headers) });
    resp.headers.set('X-Request-Id', reqId);
  }
  if (resp.status >= 500) {
    const rota = new URL(request.url).pathname;
    rid.logJson('error', 'resposta ' + resp.status, { rid: reqId, rota, metodo: request.method, codigo: resp.status });
    const guardar = deps.guardarErro || guardarErroPadrao;
    await Promise.race([
      Promise.resolve().then(() => guardar(env, { rid: reqId, rota, metodo: request.method, codigo: resp.status, msg: 'resposta ' + resp.status })).catch(() => false),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
  }
  return resp;
}

// Grava só se o Worker tem banco (chave de serviço ou D1); nos testes e sem chave, não faz nada.
async function guardarErroPadrao(env, item) {
  if (!env || !(env.FIREBASE_SERVICE_ACCOUNT_BASE64 || (env.NEXIA_D1_TOKEN && env.NEXIA_D1_ACCOUNT_ID))) return false;
  const db = require('../netlify/functions/central/saude-historico.js').abrirBanco(process.env);
  return rid.guardarErro(db, item);
}

async function atender(request, env, { getFunction }, reqId) {
  populateProcessEnv(env);
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/\/+/g, '/').replace(/(.+)\/$/, '$1') || '/';

  if (request.method === 'OPTIONS') {
    // APIs dos sites de clientes (…pages.dev): quem chama é uma página em OUTRO endereço e a autenticação vai no
    // corpo do pedido (nunca em cookie), então a pergunta prévia (CORS) precisa liberar qualquer origem, igual
    // ao que a própria função já responde. Sem isso o navegador bloqueia o painel e o formulário de reserva.
    if (CORS_ABERTO.has(pathname)) {
      return new Response(null, { status: 204, headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      } });
    }
    return new Response(null, { status: 204, headers: {
      'Access-Control-Allow-Origin': corsOrigin(env, request.headers),
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Tenant-Id',
    } });
  }
  if (pathname === '/.well-known/assetlinks.json') {
    const base = require('../apps/body-coach/android/assetlinks.json');
    // Digitais extras do app (ASSETLINKS_SHA256, separadas por vírgula): sem elas o Android abre o app como aba do Chrome.
    const digitais = String(env.ASSETLINKS_SHA256 || '').split(',').map(x => x.trim().toUpperCase()).filter(x => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(x));
    // Acrescenta às digitais do arquivo (chave de envio): com a Play, a chave que assina o app instalado é outra (Assinatura de apps do Play Console).
    const links = digitais.length ? base.map(l => ({ ...l, target: { ...l.target, sha256_cert_fingerprints: [...new Set([...(l.target.sha256_cert_fingerprints || []), ...digitais])] } })) : base;
    return json(200, links, { 'Cache-Control': 'public, max-age=3600', 'Access-Control-Allow-Origin': '*' });
  }
  if (pathname === '/health') {
    return json(200, { status: 'ok', version: VERSION, runtime: 'cloudflare-worker', frontend: !!env.ASSETS, timestamp: new Date().toISOString() },
      { 'Access-Control-Allow-Origin': '*' });
  }
  if (pathname === '/__/firebase/init.json' || pathname.startsWith('/__/auth/')) return proxyAuth(request, url);
  if (pathname === '/api/firebase-config') return firebaseConfig(env, undefined, request);
  if (pathname.startsWith('/api/') || pathname.startsWith('/.netlify/functions/')) {
    return runFunction(resolveFunctionName(pathname), request, url, env, getFunction, reqId);
  }
  return serveStatic(request, url, env);
}

module.exports = { handleRequest, populateProcessEnv, toEvent, firebaseConfig, _resetWebConfigCache, MAX_BODY_SIZE, authDomainProprio, KERNEX_HOSTS };
