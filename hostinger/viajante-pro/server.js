'use strict';
// Viajante Pro na Hostinger (app Node.js do plano Business).
// Serve as MESMAS páginas e a MESMA API de hoje; só a infraestrutura muda:
//   Firestore  -> MySQL da Hostinger (lib/docstore.js + lib/drivers.js)
//   Brevo      -> SMTP da Hostinger   (lib/email-smtp.js)
//   Firebase no navegador (páginas antigas guia/passageiro) -> core/firebase-hostinger.js
// Sem Express: só módulos do Node, para subir rápido e sem surpresa.

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const AQUI = __dirname;

// ── .env (só no servidor; nunca no repositório) ──────────────────────────
function carregarEnv(arquivo) {
  if (!fs.existsSync(arquivo)) return;
  for (const linha of fs.readFileSync(arquivo, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(linha);
    if (!m || linha.trim().startsWith('#')) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}
carregarEnv(path.join(AQUI, '.env'));

// No pacote de deploy os arquivos do site ficam em ./app; no repositório, na raiz.
const RAIZ = process.env.VP_RAIZ
  || (fs.existsSync(path.join(AQUI, 'app', 'viajante-pro')) ? path.join(AQUI, 'app') : path.resolve(AQUI, '..', '..'));

const { DocStore } = require('./lib/docstore');
const { mysqlDriver, sqliteDriver } = require('./lib/drivers');
const { instalarSmtp } = require('./lib/email-smtp');

// ── Banco ────────────────────────────────────────────────────────────────
function criarDriver(env) {
  if ((env.DB_DRIVER || '').toLowerCase() === 'sqlite') return sqliteDriver(env.SQLITE_FILE || ':memory:');
  return mysqlDriver({ host: env.DB_HOST, port: env.DB_PORT, user: env.DB_USER, password: env.DB_PASS, database: env.DB_NAME });
}

function criarApp(opcoes = {}) {
  const env = opcoes.env || process.env;
  const driver = opcoes.driver || criarDriver(env);
  const db = new DocStore(driver);
  if (!opcoes.semSmtp) instalarSmtp(env, opcoes.smtp || {});

  // A API usa este gancho quando existe (veja abrirBanco em viajante-pro.js).
  globalThis.__NEXIA_FIRESTORE_MOCK__ = db;
  const vpApi = require(path.join(RAIZ, 'netlify', 'functions', 'viajante-pro.js'));
  const leadsApi = require(path.join(RAIZ, 'netlify', 'functions', 'leads.js')).createHandler({
    getDb: () => db,
    getMw: () => ({ verifyBearerToken: async () => ({ ok: false }) }), // painel de leads da Kernex não existe aqui
    env,
  });
  const { TENANT_PAGES } = require(path.join(RAIZ, 'lib', 'routes.js'));

  // Rotas de página: as mesmas do Worker (só as do Viajante Pro) + "/" = landing.
  const PAGINAS = { '/': ['viajante-pro', 'vp-landing.html'] };
  for (const [rota, alvo] of Object.entries(TENANT_PAGES)) {
    if (alvo[0] === 'viajante-pro' || alvo[0].startsWith('viajante-pro/')) PAGINAS[rota] = alvo;
  }
  const PASTAS_PUBLICAS = ['viajante-pro', 'core'];

  const MIME = {
    '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.png': 'image/png',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp',
    '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
    '.mp4': 'video/mp4', '.webm': 'video/webm',
  };

  // Troca o SDK do Firebase (gstatic) pelo adaptador local, só na resposta (o arquivo do repo não muda).
  const RE_FIREBASE = /\s*<script[^>]+gstatic\.com\/firebasejs\/[^"']+firebase-(app|auth|firestore)-compat\.js["'][^>]*><\/script>/g;
  const cacheHtml = new Map();
  function lerHtml(arquivo) {
    const st = fs.statSync(arquivo);
    const c = cacheHtml.get(arquivo);
    if (c && c.mtime === st.mtimeMs) return c.html;
    let html = fs.readFileSync(arquivo, 'utf8');
    let trocou = false;
    html = html.replace(RE_FIREBASE, () => {
      if (trocou) return '';
      trocou = true;
      return '\n  <script src="/core/firebase-hostinger.js"></script>';
    });
    cacheHtml.set(arquivo, { mtime: st.mtimeMs, html });
    return html;
  }

  function cabecalhosBase(res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    if (env.FORCE_HTTPS !== '0') res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  }

  function enviarArquivo(req, res, arquivo) {
    const ext = path.extname(arquivo).toLowerCase();
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    if (ext === '.html') {
      res.setHeader('Cache-Control', 'no-cache');
      const html = lerHtml(arquivo);
      res.writeHead(200);
      return res.end(req.method === 'HEAD' ? undefined : html);
    }
    // service workers e manifest sem cache longo; o resto 1 dia
    const curto = /sw[^/]*\.js$|manifest/.test(arquivo);
    res.setHeader('Cache-Control', curto ? 'no-cache' : 'public, max-age=86400');
    if (/\/sw[^/]*\.js$/.test(arquivo)) res.setHeader('Service-Worker-Allowed', '/');
    res.writeHead(200);
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(arquivo).pipe(res);
  }

  function arquivoSeguro(base, relativo) {
    const alvo = path.resolve(base, '.' + path.sep + relativo);
    if (!alvo.startsWith(path.resolve(base) + path.sep)) return null;
    if (relativo.split('/').some(p => p.startsWith('.'))) return null;
    try { if (fs.statSync(alvo).isFile()) return alvo; } catch { /* não existe */ }
    return null;
  }

  function lerCorpo(req, limite = 12 * 1024 * 1024) {
    return new Promise((resolve, reject) => {
      const partes = [];
      let total = 0;
      req.on('data', c => {
        total += c.length;
        if (total > limite) { reject(Object.assign(new Error('grande demais'), { status: 413 })); req.destroy(); return; }
        partes.push(c);
      });
      req.on('end', () => resolve(Buffer.concat(partes).toString('utf8')));
      req.on('error', reject);
    });
  }

  async function chamarFuncao(fn, req, res, url) {
    const corpo = ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? '' : await lerCorpo(req);
    const evento = {
      httpMethod: req.method,
      path: url.pathname,
      headers: req.headers,
      queryStringParameters: Object.fromEntries(url.searchParams.entries()),
      body: corpo,
      isBase64Encoded: false,
    };
    const r = await fn(evento, { env });
    const status = (r && r.statusCode) || 200;
    for (const [k, v] of Object.entries((r && r.headers) || {})) res.setHeader(k, v);
    res.writeHead(status);
    if (r && r.body != null && status !== 204) res.end(r.isBase64Encoded ? Buffer.from(r.body, 'base64') : r.body);
    else res.end();
  }

  // ── /api/vp-docs: banco das páginas antigas (guia/passageiro) ──────────
  // Só grava em tenants/viajante-pro/<subcoleção permitida>. Leitura devolve vazio
  // (hoje essas leituras exigem login de guia/admin, que não existe para visitante).
  const SUB_GRAVAVEIS = ['alerts', 'expenses', 'passengers', 'passenger_docs', 'checkins', 'audit', 'audit_log', 'logs'];
  function caminhoGravavel(p) {
    const partes = String(p || '').split('/');
    return partes.length >= 3 && partes.length <= 4 && partes[0] === 'tenants' && partes[1] === 'viajante-pro'
      && SUB_GRAVAVEIS.includes(partes[2]) && partes.every(x => /^[A-Za-z0-9_.@-]{1,190}$/.test(x));
  }
  async function vpDocs(req, res) {
    const json = (s, b) => { res.writeHead(s, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(b)); };
    if (req.method !== 'POST') return json(405, { error: 'Use POST.' });
    let b;
    try { b = JSON.parse(await lerCorpo(req, 2 * 1024 * 1024)); } catch { return json(400, { error: 'Pedido inválido.' }); }
    const op = String(b.op || '');
    if (op === 'get') return json(200, { exists: false, data: null });
    if (op === 'list') return json(200, { docs: [] });
    if (!['add', 'set', 'update'].includes(op) || !caminhoGravavel(b.path)) return json(403, { error: 'Sem permissão.' });
    const partes = b.path.split('/');
    const dados = b.data && typeof b.data === 'object' ? b.data : {};
    if (op === 'add') {
      if (partes.length !== 3) return json(400, { error: 'Caminho inválido.' });
      const ref = await db.collection('tenants').doc('viajante-pro').collection(partes[2]).add(dados);
      return json(200, { ok: true, id: ref.id });
    }
    if (partes.length !== 4) return json(400, { error: 'Caminho inválido.' });
    const ref = db.collection('tenants').doc('viajante-pro').collection(partes[2]).doc(partes[3]);
    if (op === 'set') await ref.set(dados, { merge: !!b.merge });
    else {
      const snap = await ref.get();
      if (!snap.exists) return json(404, { error: 'Não existe.' });
      await ref.update(dados);
    }
    return json(200, { ok: true, id: partes[3] });
  }

  async function tratar(req, res) {
    cabecalhosBase(res);
    // HTTPS forçado (a Hostinger informa o protocolo original neste cabeçalho)
    if (env.FORCE_HTTPS !== '0' && String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'http') {
      res.writeHead(301, { Location: `https://${req.headers.host}${req.url}` });
      return res.end();
    }
    const url = new URL(req.url, 'http://local');
    let p = decodeURIComponent(url.pathname);
    if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);

    if (p === '/api/viajante-pro') return chamarFuncao(vpApi.handler, req, res, url);
    if (p === '/api/leads') return chamarFuncao(leadsApi, req, res, url);
    if (p === '/api/vp-docs') return vpDocs(req, res);
    if (p === '/api/firebase-config') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify({ apiKey: 'hostinger', projectId: 'viajante-pro', authDomain: req.headers.host || 'viajante.pro', hostinger: true }));
    }
    if (p === '/saude') {
      let banco = false;
      try { banco = await driver.saude(); } catch { banco = false; }
      res.writeHead(banco ? 200 : 503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify({ ok: banco, banco: banco ? 'ok' : 'erro', driver: driver.tipo }));
    }
    if (p.startsWith('/api/')) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Rota não encontrada.' }));
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }

    if (PAGINAS[p]) {
      const [pasta, arq] = PAGINAS[p];
      const f = arquivoSeguro(path.join(RAIZ, pasta), arq);
      if (f) return enviarArquivo(req, res, f);
    }
    if (p === '/core/firebase-hostinger.js') return enviarArquivo(req, res, path.join(AQUI, 'public', 'firebase-hostinger.js'));
    if (p === '/favicon.ico') {
      const f = arquivoSeguro(path.join(RAIZ, 'viajante-pro', 'app'), 'icone-192.png');
      if (f) return enviarArquivo(req, res, f);
    }
    const seg = p.split('/')[1];
    if (PASTAS_PUBLICAS.includes(seg)) {
      const f = arquivoSeguro(RAIZ, p.slice(1));
      if (f) return enviarArquivo(req, res, f);
    }
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end('<!doctype html><meta charset="utf-8"><title>Página não encontrada</title><p style="font-family:sans-serif;padding:2rem">Página não encontrada. <a href="/">Voltar ao início</a></p>');
  }

  const servidor = http.createServer((req, res) => {
    tratar(req, res).catch(e => {
      console.error('[erro]', req.method, req.url, e && e.stack);
      if (!res.headersSent) res.writeHead(e && e.status === 413 ? 413 : 500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e && e.status === 413 ? 'Arquivo grande demais.' : 'Erro interno.' }));
    });
  });
  return { servidor, db, driver, PAGINAS };
}

if (require.main === module) {
  const { servidor, driver } = criarApp();
  // A Hostinger (LiteSpeed) pode passar PORT como número ou como caminho de socket; os dois funcionam no listen().
  const bruto = process.env.PORT;
  const porta = bruto ? (/^\d+$/.test(bruto) ? Number(bruto) : bruto) : 3000;
  process.on('uncaughtException', e => console.error('[erro não tratado]', e && e.stack));
  process.on('unhandledRejection', e => console.error('[promessa rejeitada]', e && (e.stack || e)));
  driver.preparar()
    .then(() => console.log('[banco] pronto (' + driver.tipo + ')'))
    .catch(e => console.error('[banco] não conectou:', e.message, '— confira DB_HOST/DB_NAME/DB_USER/DB_PASS no .env'));
  servidor.listen(porta, () => console.log(`Viajante Pro no ar na porta ${porta} (arquivos em ${RAIZ})`));
}

module.exports = { criarApp };
