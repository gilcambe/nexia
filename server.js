'use strict';
/**
 * NEXIA OS v60 — Servidor Unificado (patch: /core/* + admin routes)
 * Backend completo (v58) + Frontend React (v59)
 * - Serve o React SPA compilado em /out
 * - Expõe todas as APIs reais via netlify/functions
 * - Firebase Auth + Firestore pela API REST (lib/firebase-lite, ADR-FREE-01)
 * - Auto-build se out/ não existir
 */

const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const url    = require('url');
const { execSync } = require('child_process');
const { normalizeRequestPath, resolveStatic } = require('./lib/safe-static');
const { publicErrorBody } = require('./lib/safe-error');
const { isStreamResult, writeStream } = require('./lib/stream-response');
const { PUBLIC_DIRS, TENANT_PAGES, resolveFunctionName } = require('./lib/routes');

const PORT = process.env.PORT || 3001;
const ROOT = __dirname;
const OUT  = path.join(ROOT, 'out');
const MAX_BODY_SIZE = 1 * 1024 * 1024;

// ─── AUTO-BUILD se out/ não existir ──────────────────────────────
if (require.main === module && !fs.existsSync(path.join(OUT, 'index.html'))) {
  console.log('[NEXIA] Frontend não compilado — rodando build...');
  try {
    execSync('npm install && npm run build', { cwd: ROOT, stdio: 'inherit', timeout: 300000 });
    console.log('[NEXIA] Build concluído.');
  } catch (e) {
    console.error('[NEXIA] Build falhou:', e.message);
    process.exit(1);
  }
}

// ─── CORS ─────────────────────────────────────────────────────────
// ADR-HOST-01: sem NEXIA_APP_URL, só o próprio endereço (mesma origem dispensa CORS).
const ALLOWED_ORIGINS = (process.env.NEXIA_APP_URL || '')
  .split(',').map(u => u.trim()).filter(Boolean);

function getCorsOrigin(reqHeaders) {
  if (!ALLOWED_ORIGINS.length) return '';
  const origin = (reqHeaders && (reqHeaders.origin || reqHeaders.Origin)) || '';
  return ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
}

// ─── RATE LIMITER ─────────────────────────────────────────────────
const RATE_STORE  = new Map();
const RATE_LIMITS = { free: 50, starter: 500, pro: 99999, enterprise: 99999 };
function checkRateLimit(uid, plan) {
  const now = Date.now(), monthKey = new Date().toISOString().slice(0, 7);
  const key = `${uid}:${monthKey}`;
  if (!RATE_STORE.has(key)) {
    const d = new Date();
    RATE_STORE.set(key, { count: 0, reset: new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime() });
  }
  const entry = RATE_STORE.get(key);
  if (now > entry.reset) { const d = new Date(); entry.count = 0; entry.reset = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime(); }
  const limit = RATE_LIMITS[plan] ?? RATE_LIMITS.free;
  if (entry.count >= limit) return { allowed: false, remaining: 0, limit };
  entry.count++;
  return { allowed: true, remaining: limit - entry.count, limit };
}
setInterval(() => { const now = Date.now(); for (const [k, e] of RATE_STORE.entries()) if (now > e.reset) RATE_STORE.delete(k); }, 3600000).unref();

// ─── FIREBASE CONFIG endpoint ─────────────────────────────────────
function serveFirebaseConfig(res) {
  if (!process.env.FIREBASE_API_KEY) {
    res.writeHead(503, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ error: 'Firebase config unavailable. Configure FIREBASE_API_KEY nos segredos do Worker (wrangler secret put).' }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify({
    apiKey:            process.env.FIREBASE_API_KEY,
    authDomain:        process.env.FIREBASE_AUTH_DOMAIN         || '',
    projectId:         process.env.FIREBASE_PROJECT_ID          || '',
    storageBucket:     process.env.FIREBASE_STORAGE_BUCKET      || '',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
    appId:             process.env.FIREBASE_APP_ID              || '',
  }));
}

// ─── MIME TYPES ───────────────────────────────────────────────────
const MIME = {
  '.html':'.html', '.css':'text/css', '.js':'application/javascript',
  '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png',
  '.jpg':'image/jpeg', '.webp':'image/webp', '.ico':'image/x-icon',
  '.woff':'font/woff', '.woff2':'font/woff2', '.ttf':'font/ttf',
  '.txt':'text/plain', '.xml':'application/xml',
};
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css',
  '.js': 'application/javascript', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf',
};

// ─── AJUDANTE & BUSCA NO MANUAL ───────────────────────────────────
function sanitizarTexto(texto) {
  if (typeof texto !== 'string') return '';
  return texto
    .replace(/(?:gsk_|AIza[0-9A-Za-z-_]{35}|sk-[a-zA-Z0-9]{20,}|Bearer\s+[A-Za-z0-9._-]{10,})/g, '[REDACTED]')
    .replace(/(?:api[_-]?key|secret|token)["']?\s*[:=]\s*["']?[A-Za-z0-9-_]{8,}["']?/gi, '$1: [REDACTED]');
}

function buscarNoManual(pergunta) {
  try {
    const manualPath = path.join(ROOT, 'docs', 'MANUAL-CENTRAL-E-CORTEX.md');
    if (!fs.existsSync(manualPath)) {
      return 'Não sei responder com as informações disponíveis. Consulte a seção relevante em docs/MANUAL-CENTRAL-E-CORTEX.md.';
    }
    const conteudo = fs.readFileSync(manualPath, 'utf8');
    const blocos = conteudo.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
    if (!blocos.length) {
      return 'Não sei responder com as informações disponíveis. Consulte a seção relevante em docs/MANUAL-CENTRAL-E-CORTEX.md.';
    }

    const palavrasPergunta = (pergunta || '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2);

    if (!palavrasPergunta.length) {
      return 'Não sei responder sem uma pergunta clara. Consulte a seção relevante em docs/MANUAL-CENTRAL-E-CORTEX.md.';
    }

    let melhorParagrafo = null;
    let maxPontos = 0;
    let secaoCorrespondente = 'Visão Geral';

    for (const bloco of blocos) {
      const matchHeader = bloco.match(/^#+\s*(.+)$/m);
      if (matchHeader) {
        secaoCorrespondente = matchHeader[1].trim();
      }
      const palavrasBloco = bloco
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2);

      let pontos = 0;
      for (const pq of palavrasPergunta) {
        for (const pb of palavrasBloco) {
          if (pq === pb) {
            pontos += 2;
          } else if (pq.length >= 4 && (pb.startsWith(pq) || pq.startsWith(pb))) {
            pontos += 1;
          }
        }
      }

      if (pontos > maxPontos) {
        maxPontos = pontos;
        melhorParagrafo = bloco;
      }
    }

    if (maxPontos > 0 && melhorParagrafo) {
      return sanitizarTexto(melhorParagrafo);
    }

    return `Não sei responder com as informações disponíveis. Consulte a seção relevante em docs/MANUAL-CENTRAL-E-CORTEX.md (${secaoCorrespondente}).`;
  } catch {
    return 'Não sei responder no momento. Consulte a seção relevante em docs/MANUAL-CENTRAL-E-CORTEX.md.';
  }
}

async function freeIAHelper(pergunta) {
  if (!pergunta || typeof pergunta !== 'string' || !pergunta.trim()) {
    return 'Não sei responder sem uma pergunta válida. Consulte docs/MANUAL-CENTRAL-E-CORTEX.md.';
  }

  const promptSistema = 'Você é o Ajudante da Central e do Cortex. Responda em português simples e direto. Nunca exponha chaves ou dados confidenciais. Se não souber com certeza, responda que não sabe e cite a seção correspondente em docs/MANUAL-CENTRAL-E-CORTEX.md.';

  // 1. Workers AI
  const cfAccount = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID;
  const cfToken = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN;
  if (cfAccount && cfToken) {
    try {
      const resp = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfAccount}/ai/run/@cf/meta/llama-3.1-8b-instruct`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${cfToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'system', content: promptSistema }, { role: 'user', content: pergunta }] }),
        signal: AbortSignal.timeout(6000),
      });
      if (resp.ok) {
        const j = await resp.json();
        const texto = j?.result?.response;
        if (texto && typeof texto === 'string' && texto.trim()) return sanitizarTexto(texto.trim());
      }
    } catch {}
  }

  // 2. Groq
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    try {
      const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [{ role: 'system', content: promptSistema }, { role: 'user', content: pergunta }],
          max_tokens: 400,
        }),
        signal: AbortSignal.timeout(6000),
      });
      if (resp.ok) {
        const j = await resp.json();
        const texto = j?.choices?.[0]?.message?.content;
        if (texto && typeof texto === 'string' && texto.trim()) return sanitizarTexto(texto.trim());
      }
    } catch {}
  }

  // 3. Gemini
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: promptSistema }] },
          contents: [{ parts: [{ text: pergunta }] }],
        }),
        signal: AbortSignal.timeout(6000),
      });
      if (resp.ok) {
        const j = await resp.json();
        const texto = j?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (texto && typeof texto === 'string' && texto.trim()) return sanitizarTexto(texto.trim());
      }
    } catch {}
  }

  // 4. OpenRouter grátis
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (openRouterKey) {
    try {
      const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openRouterKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.1-8b-instruct:free',
          messages: [{ role: 'system', content: promptSistema }, { role: 'user', content: pergunta }],
          max_tokens: 400,
        }),
        signal: AbortSignal.timeout(6000),
      });
      if (resp.ok) {
        const j = await resp.json();
        const texto = j?.choices?.[0]?.message?.content;
        if (texto && typeof texto === 'string' && texto.trim()) return sanitizarTexto(texto.trim());
      }
    } catch {}
  }

  // 5. Mistral
  const mistralKey = process.env.MISTRAL_API_KEY;
  if (mistralKey) {
    try {
      const resp = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${mistralKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'mistral-small-latest',
          messages: [{ role: 'system', content: promptSistema }, { role: 'user', content: pergunta }],
          max_tokens: 400,
        }),
        signal: AbortSignal.timeout(6000),
      });
      if (resp.ok) {
        const j = await resp.json();
        const texto = j?.choices?.[0]?.message?.content;
        if (texto && typeof texto === 'string' && texto.trim()) return sanitizarTexto(texto.trim());
      }
    } catch {}
  }

  // Fallback para o manual
  return buscarNoManual(pergunta);
}

// ─── CARREGA FUNCTIONS ────────────────────────────────────────────
const FUNCTIONS_DIR = path.join(ROOT, 'netlify', 'functions');
const loadedFunctions = {};
function loadFunctions() {
  if (!fs.existsSync(FUNCTIONS_DIR)) {
    console.warn('[FN] netlify/functions/ não encontrado — APIs indisponíveis');
    return;
  }
  const files = fs.readdirSync(FUNCTIONS_DIR)
    .filter(f => f.endsWith('.js') && !['firebase-init.js', 'middleware.js'].includes(f));
  for (const file of files) {
    const name = file.replace('.js', '');
    try {
      loadedFunctions[name] = require(path.join(FUNCTIONS_DIR, file));
      console.log('[FN] ✓', name);
    } catch (e) {
      console.warn('[FN] ✗', name, '-', e.message);
    }
  }
  // NEXIA AI (Fase 3): módulo novo fora de netlify/functions, mesmo formato de handler
  try { loadedFunctions['nexia-api'] = require(path.join(ROOT, 'nexia-ai', 'api')); console.log('[FN] ✓ nexia-api'); }
  catch (e) { console.warn('[FN] ✗ nexia-api -', e.message); }
  console.log('[FN] Total:', Object.keys(loadedFunctions).length + '/' + files.length);
}

// ─── ADAPTER: Node req/res → Netlify event ────────────────────────
async function runFunction(fnName, req, res, body) {
  const fn = loadedFunctions[fnName];
  if (!fn || !fn.handler) {
    res.writeHead(404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': getCorsOrigin(req.headers) });
    res.end(JSON.stringify({ error: 'Function não encontrada: ' + fnName }));
    return;
  }
  const parsedUrl = url.parse(req.url, true);
  const event = {
    httpMethod: req.method,
    path: parsedUrl.pathname,
    queryStringParameters: parsedUrl.query || {},
    headers: req.headers,
    body: body && body.length ? body.toString('utf8') : null,
    isBase64Encoded: false,
  };
  try {
    const result = await fn.handler(event, {});
    const baseHeaders = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': getCorsOrigin(req.headers),
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Tenant-Id',
    };
    // NEXIA AI (Fase 5): streaming real quando o handler devolve { stream }
    if (isStreamResult(result)) return writeStream(req, res, result, baseHeaders);
    res.writeHead(result.statusCode || 200, { ...baseHeaders, ...(result.headers || {}) });
    res.end(result.body || '');
  } catch (e) {
    // SEC Fase 1 (A5): detalhe só no log, cliente recebe correlationId
    res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': getCorsOrigin(req.headers) });
    res.end(JSON.stringify(publicErrorBody('FN ' + fnName, e)));
  }
}

// ─── SERVE ARQUIVO ESTÁTICO ───────────────────────────────────────
function sendNotFound(res, status = 404) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify({ error: status === 405 ? 'Method Not Allowed' : status === 400 ? 'Bad Request' : 'Not Found' }));
}

// serveFile recebe apenas caminhos já validados por resolveStatic()
function serveFile(filePath, res) {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return false;
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    const cacheable = ['.css','.woff2','.svg','.png','.jpg','.ico','.woff','.ttf','.webp','.js'].includes(ext);
    res.writeHead(200, {
      'Content-Type': mime,
      'Cache-Control': cacheable ? 'public, max-age=31536000, immutable' : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Access-Control-Allow-Origin': '*',
    });
    fs.createReadStream(filePath).pipe(res);
    return true;
  } catch { return false; }
}

// ─── SERVIDOR HTTP ────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url);
  const pathname  = (parsedUrl.pathname || '/').replace(/\/\/+/g, '/').replace(/(.+)\/$/, '$1') || '/';

  // OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': getCorsOrigin(req.headers),
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Tenant-Id',
    });
    return res.end();
  }

  // Health
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({
      status: 'ok', version: '60.0.0',
      uptime: Math.floor(process.uptime()),
      functions: Object.keys(loadedFunctions).length,
      frontend: fs.existsSync(path.join(OUT, 'index.html')),
      timestamp: new Date().toISOString(),
    }));
  }

  // Firebase config
  if (pathname === '/api/firebase-config') {
    return serveFirebaseConfig(res);
  }

  // APIs → functions
  if (pathname.startsWith('/api/') || pathname.startsWith('/.netlify/functions/')) {
    const chunks = []; let bodySize = 0;
    req.on('data', c => {
      bodySize += c.length;
      if (bodySize > MAX_BODY_SIZE) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Payload muito grande.' }));
        req.destroy(); return;
      }
      chunks.push(c);
    });
    req.on('end', async () => {
      const raw = Buffer.concat(chunks);
      let payload = {};
      try { payload = JSON.parse(raw.toString('utf8')); } catch {}
      const acao = payload.acao || (parsedUrl.query && parsedUrl.query.acao);

      if ((pathname === '/api/pedidos' || pathname === '/.netlify/functions/pedidos') && acao === 'ajudante') {
        const pergunta = payload.pergunta || (parsedUrl.query && parsedUrl.query.pergunta) || '';
        try {
          const resposta = await freeIAHelper(pergunta);
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': getCorsOrigin(req.headers) || '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Tenant-Id',
          });
          return res.end(JSON.stringify({ ok: true, resposta, texto: resposta }));
        } catch {
          const fallback = buscarNoManual(pergunta);
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': getCorsOrigin(req.headers) || '*',
          });
          return res.end(JSON.stringify({ ok: true, resposta: fallback, texto: fallback }));
        }
      }

      const fnName = resolveFunctionName(pathname);
      runFunction(fnName, req, res, raw);
    });
    return;
  }

  // ─── ARQUIVOS ESTÁTICOS (SEC Fase 1, C1) ───────────────────────
  // Só GET/HEAD; só raízes públicas explícitas; caminho decodificado,
  // normalizado e com symlinks resolvidos precisa ficar dentro da raiz.
  if (req.method !== 'GET' && req.method !== 'HEAD') return sendNotFound(res, 405);

  const safePath = normalizeRequestPath(parsedUrl.pathname || '/');
  if (safePath === null) return sendNotFound(res, 400);

  const mapped = TENANT_PAGES[safePath.replace(/\/$/, '')];
  if (mapped) {
    const f = resolveStatic(path.join(ROOT, mapped[0]), mapped[1]);
    if (f && serveFile(f, res)) return;
  }

  // Pastas públicas do legado: /core/*, /ces/*, /bezsan/*, /splash/*, /viajante-pro/*
  const first = safePath.split('/')[1];
  if (PUBLIC_DIRS.includes(first)) {
    const f = resolveStatic(path.join(ROOT, first), safePath.slice(first.length + 2));
    if (f && serveFile(f, res)) return;
  }

  // Frontend React compilado (out/)
  const fromOut = resolveStatic(OUT, safePath);
  if (fromOut && serveFile(fromOut, res)) return;

  // Caminho com extensão que não existe/é negado → 404 (sem SPA fallback).
  // Exceção: .html inexistente cai no index.html do SPA, como antes da Fase 1
  // (links legados como /nexia/observability.html); nunca serve o arquivo pedido.
  const ext = path.extname(safePath).toLowerCase();
  if (ext && ext !== '.html') return sendNotFound(res, 404);

  // SPA fallback — rotas React sem extensão (ou .html legado) caem no index.html
  const indexFile = resolveStatic(OUT, 'index.html');
  if (indexFile && serveFile(indexFile, res)) return;
  return sendNotFound(res, 404);
});

// ─── KEEPALIVE ────────────────────────────────────────────────────
function startKeepalive() {
  const appUrl = process.env.NEXIA_APP_URL;
  if (!appUrl) return;
  setInterval(async () => {
    try {
      const r = await fetch(appUrl + '/health');
      console.log('[KEEPALIVE] Ping OK —', r.status);
    } catch (e) { console.warn('[KEEPALIVE] Falhou:', e.message); }
  }, 10 * 60 * 1000);
  console.log('[KEEPALIVE] Ativo → URL:', appUrl);
}

// ─── START ────────────────────────────────────────────────────────
loadFunctions();
module.exports = { server, resolveFunctionName, buscarNoManual, freeIAHelper, sanitizarTexto };
if (require.main !== module) return;
server.listen(PORT, () => {
  console.log('\n[NEXIA OS v60] Servidor unificado na porta', PORT);
  console.log('[NEXIA] Frontend React:', fs.existsSync(path.join(OUT, 'index.html')) ? '✓' : '✗ (build pendente)');
  console.log('[NEXIA] Functions:', Object.keys(loadedFunctions).length, 'carregadas');
  console.log('[NEXIA] URL:', process.env.NEXIA_APP_URL || 'http://localhost:' + PORT);
  startKeepalive();
});
process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT',  () => server.close(() => process.exit(0)));
process.on('uncaughtException',  (e) => console.error('[NEXIA] uncaughtException:', e.message));
process.on('unhandledRejection', (r) => console.error('[NEXIA] unhandledRejection:', r));
