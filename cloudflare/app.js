'use strict';
// NEXIA no Cloudflare Worker grátis (ADR-FREE-01). Faz o papel do server.js:
//  - /health e /api/firebase-config;
//  - /api/*, /v1/* e /.netlify/functions/* → handlers no formato Netlify (mesmo código do server.js);
//  - estáticos (site React em out/ e pastas públicas do legado) pelo binding ASSETS.
const { normalizeRequestPath } = require('../lib/safe-path');
const { publicErrorBody } = require('../lib/safe-error');
const { isStreamResult } = require('../lib/stream-response');
const { TENANT_PAGES, resolveFunctionName } = require('../lib/routes');
const { createTokenSource } = require('../lib/firebase-lite/google-auth');
const rid = require('../lib/rid');

const MAX_BODY_SIZE = 1 * 1024 * 1024;
const CORS_ABERTO = new Set(['/api/locacao', '/api/nutri', '/v1/chat/completions', '/v1/models']);
const VERSION = '61.0.0';

function corsOrigin(env, headers) {
  const allowed = String(env.NEXIA_APP_URL || '').split(',').map(u => u.trim()).filter(Boolean);
  if (!allowed.length) return '*';
  const origin = headers.get('origin') || '';
  return allowed.includes(origin) ? origin : allowed[0];
}

const json = (status, body, headers = {}) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff', ...headers },
});

const notFound = (status = 404, msg = 'Não encontrado') => json(status, { error: msg });

async function loadStatic(env, url) {
  if (!env.ASSETS) return null;
  const path = normalizeRequestPath(url.pathname);
  try {
    const assetUrl = new URL(path === '/' ? '/index.html' : path, url.origin);
    let res = await env.ASSETS.fetch(new Request(assetUrl, { method: 'GET' }));
    if (!res.ok && !path.includes('.')) {
      res = await env.ASSETS.fetch(new Request(new URL('/index.html', url.origin), { method: 'GET' }));
    }
    return res;
  } catch {
    return null;
  }
}

async function handleRequest(request, env, opts = {}) {
  const url = new URL(request.url);
  const method = request.method;
  const correlationId = rid();

  const getFunction = opts.getFunction || (async (name) => {
    try {
      if (name === 'cortex-chat' || name === 'v1-chat' || name === 'openai-api') return require('../netlify/functions/cortex-chat');
      if (name === 'keys') return require('../netlify/functions/keys') || { handler: async () => ({ statusCode: 200, body: JSON.stringify({ ok: true }) }) };
      return require(`../netlify/functions/${name}`);
    } catch {
      return null;
    }
  });

  const headers = {
    'Access-Control-Allow-Origin': corsOrigin(env, request.headers),
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'X-Correlation-ID': correlationId,
  };

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (url.pathname === '/health') {
    return json(200, { ok: true, version: VERSION, ts: new Date().toISOString() }, headers);
  }

  if (url.pathname === '/api/firebase-config') {
    return json(200, {
      apiKey: env.FIREBASE_API_KEY || '',
      authDomain: env.FIREBASE_AUTH_DOMAIN || '',
      projectId: env.FIREBASE_PROJECT_ID || '',
      storageBucket: env.FIREBASE_STORAGE_BUCKET || '',
      messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID || '',
      appId: env.FIREBASE_APP_ID || '',
    }, headers);
  }

  // Roteamento OpenAI compatible /v1/*
  if (url.pathname.startsWith('/v1/')) {
    const fn = await getFunction('cortex-chat');
    if (fn && typeof fn.handler === 'function') {
      const fakeEvent = {
        httpMethod: method,
        path: url.pathname,
        headers: Object.fromEntries(request.headers.entries()),
        queryStringParameters: Object.fromEntries(url.searchParams.entries()),
        body: method === 'POST' || method === 'PUT' ? await request.text() : null,
        _is_openai: true,
      };
      try {
        const res = await fn.handler(fakeEvent, env);
        if (res.stream) {
          return new Response(res.stream, {
            status: res.statusCode || 200,
            headers: { ...headers, ...(res.headers || {}) }
          });
        }
        return new Response(res.body, {
          status: res.statusCode || 200,
          headers: { ...headers, ...(res.headers || {}) }
        });
      } catch (err) {
        return json(500, { error: err.message }, headers);
      }
    }
    return json(404, { error: 'OpenAI endpoint not found' }, headers);
  }

  let funcName = resolveFunctionName(url.pathname);
  if (!funcName && url.pathname.startsWith('/api/')) {
    const seg = url.pathname.replace('/api/', '').split('/')[0];
    if (seg) funcName = seg;
  }

  if (funcName) {
    const fn = await getFunction(funcName);
    if (fn && typeof fn.handler === 'function') {
      let bodyText = null;
      if (['POST', 'PUT', 'PATCH'].includes(method)) {
        const cl = parseInt(request.headers.get('content-length') || '0', 10);
        if (cl > MAX_BODY_SIZE) return json(413, { error: 'Payload muito grande' }, headers);
        bodyText = await request.text();
      }
      const fakeEvent = {
        httpMethod: method,
        path: url.pathname,
        headers: Object.fromEntries(request.headers.entries()),
        queryStringParameters: Object.fromEntries(url.searchParams.entries()),
        body: bodyText,
      };
      try {
        const netlifyRes = await fn.handler(fakeEvent, env);
        if (isStreamResult(netlifyRes)) {
          return new Response(netlifyRes.stream, {
            status: netlifyRes.statusCode || 200,
            headers: { ...headers, ...(netlifyRes.headers || {}) }
          });
        }
        const respHeaders = { ...headers, ...(netlifyRes.headers || {}) };
        return new Response(netlifyRes.body, {
          status: netlifyRes.statusCode || 200,
          headers: respHeaders
        });
      } catch (err) {
        return json(500, publicErrorBody('cloudflare', err, 'Erro interno no servidor'), headers);
      }
    }
  }

  if (method === 'GET' || method === 'HEAD') {
    const staticRes = await loadStatic(env, url);
    if (staticRes && staticRes.status !== 404) {
      const newHeaders = new Headers(staticRes.headers);
      for (const [k, v] of Object.entries(headers)) newHeaders.set(k, v);
      return new Response(staticRes.body, {
        status: staticRes.status,
        statusText: staticRes.statusText,
        headers: newHeaders,
      });
    }
  }

  return notFound(404, 'Rota ou arquivo não encontrado');
}

export default {
  async fetch(request, env, ctx) {
    try {
      return await handleRequest(request, env);
    } catch (err) {
      return json(500, { error: err.message || 'Internal Server Error' });
    }
  },
};
