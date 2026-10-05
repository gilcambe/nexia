'use strict';
// NEXIA Clone (ADR-CLONE-01) no navegador (Playwright + Chromium), chamado pelo workflow clonar-site.yml.
//   MODO=design  (padrão): tokens de design, ordem das seções e fotos de tela 375/768/1440 → OUT/design/
//   MODO=espelho: cópia fiel, só com AUTORIZADO=SOU_DONO_OU_AUTORIZADO e robots.txt permitindo → OUT/site/
// Uso: CLONE_URL=https://exemplo.com MODO=design OUT=/tmp/clone node scripts/clonar-site.js
// Log público (Actions de repositório público): imprime só host e contagens.
const fs = require('fs');
const path = require('path');
const cloner = require('../nexia-ai/cloner');

const { UA } = cloner;
const MODO = (process.env.MODO || 'design').trim();
const OUT = path.resolve(process.env.OUT || 'clone-out');
const MAX_FILE = 15 * 1024 * 1024;
const MAX_TOTAL = 150 * 1024 * 1024;
const SAVE_TYPES = /^(text\/html|text\/css|(text|application)\/(x-)?javascript|application\/json|application\/manifest\+json|image\/|font\/|application\/(font|x-font)|video\/(mp4|webm))/;
const sleep = ms => new Promise(r => setTimeout(r, ms));
// CHROMIUM_PATH: navegador já instalado (uso local); no Actions vale o do `npx playwright install`.
const launchOptions = () => (process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const fail = (msg, code = 2) => { console.error(`[clonar-site] ${msg}`); process.exit(code); };

/**
 * Contexto sem cookies nem credenciais: só GET/HEAD; endereços internos bloqueados (também em cada redirecionamento,
 * que volta a passar por aqui); pedido sem cookie/authorization; resposta sem Set-Cookie; document.cookie desligado.
 */
async function newContext(browser, viewport = { width: 1440, height: 900 }) {
  const dnsOk = new Map();   // host → IPs públicos? (vale para todos os pedidos da página)
  const context = await browser.newContext({ userAgent: UA, viewport, deviceScaleFactor: 1, serviceWorkers: 'block', acceptDownloads: false });
  await context.addInitScript(() => {
    try { Object.defineProperty(Document.prototype, 'cookie', { configurable: true, get: () => '', set: () => {} }); } catch { /* sem cookie */ }
  });
  await context.route('**/*', async route => {
    const req = route.request();
    const u = req.url();
    if (!/^https?:/i.test(u)) return route.continue();
    const v = cloner.validateUrl(u);
    if (!['GET', 'HEAD'].includes(req.method()) || !v.ok) return route.abort('blockedbyclient');
    if (!dnsOk.has(v.host)) dnsOk.set(v.host, (await cloner.checkResolved(v.host, cloner.defaultLookup())).ok);
    if (!dnsOk.get(v.host)) return route.abort('blockedbyclient');
    // O pedido sai pelo fetch do Node (sem pote de cookies), não pelo navegador; redirecionamento volta ao navegador.
    const headers = Object.fromEntries(Object.entries(req.headers()).filter(([k]) => !/^(cookie|authorization|proxy-authorization)$/i.test(k)));
    headers['user-agent'] = UA;
    try {
      const res = await fetch(u, { method: req.method(), headers, redirect: 'manual', signal: AbortSignal.timeout(60000) });
      const out = {};
      res.headers.forEach((v, k) => { if (!/^(set-cookie|content-encoding|content-length|transfer-encoding)$/i.test(k)) out[k] = v; });
      const body = req.method() === 'HEAD' ? Buffer.alloc(0) : Buffer.from(await res.arrayBuffer());
      return route.fulfill({ status: res.status, headers: out, body });
    } catch { return route.abort('failed').catch(() => {}); }
  });
  return context;
}

/** Rola a página até o fim (carrega imagens "lazy") e volta ao topo. */
async function scrollAll(page) {
  await page.evaluate(async () => {
    const h = () => Math.min(document.documentElement.scrollHeight, 40000);
    for (let y = 0; y < h(); y += 400) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 200)); }
    window.scrollTo(0, 0);
  }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
}

/** Abre a página; 429/503 → espera (Retry-After ou 5 s × 2^n) e tenta de novo, até 3 vezes. */
async function gotoPolite(page, url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 })
      .catch(() => page.goto(url, { waitUntil: 'load', timeout: 60000 }).catch(() => null));
    if (!res) return null;
    if (![429, 503].includes(res.status())) return res;
    const wait = cloner.backoffMs(res.headers()['retry-after'], attempt);
    console.log(`[clonar-site] servidor pediu calma (${res.status()}); esperando ${Math.round(wait / 1000)} s`);
    await sleep(wait);
  }
  return null;
}

// Tokens calculados no navegador (estilo final de cada elemento) e seções pela estrutura do DOM.
// Só valores de estilo e tipos de seção; nenhum texto, imagem ou código da página sai daqui.
function browserTokens() {
  const out = { colors: {}, fonts: { heading: {}, body: {} }, font_sizes: {}, font_weights: {}, radii: {}, shadows: {}, spacing: {}, custom_properties: {}, layout: [], blocks: [] };
  const add = (m, k, n = 1) => { if (k) m[k] = (m[k] || 0) + n; };
  const hex = c => {
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(c || '');
    if (!m || (m[4] !== undefined && Number(m[4]) < 0.5)) return null;
    return `#${[m[1], m[2], m[3]].map(x => Number(x).toString(16).padStart(2, '0')).join('')}`;
  };
  const color = (h, role, button) => {
    if (!h) return;
    out.colors[h] = out.colors[h] || { bg: 0, text: 0, border: 0, other: 0, button: 0 };
    out.colors[h][role]++;
    if (button) out.colors[h].button++;
  };
  const fam = v => (String(v || '').split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).find(s => s && !/^(serif|sans-serif|monospace|system-ui|-apple-system|BlinkMacSystemFont|ui-\w+)$/i.test(s) && !/icon|awesome|material/i.test(s)) || null);
  const els = [...document.querySelectorAll('body, header, nav, main, section, footer, h1, h2, h3, p, a, button, input, textarea, [class*="btn"], [class*="card"], li, blockquote')].slice(0, 600);
  for (const el of els) {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') continue;
    const isBtn = el.tagName === 'BUTTON' || /\bbtn|button|cta\b/i.test(el.className && el.className.baseVal === undefined ? el.className : '');
    color(hex(s.backgroundColor), 'bg', isBtn);
    if ((el.textContent || '').trim()) color(hex(s.color), 'text');
    if (parseFloat(s.borderTopWidth) > 0) color(hex(s.borderTopColor), 'border');
    const f = fam(s.fontFamily);
    if (/^H[1-3]$/.test(el.tagName)) { add(out.fonts.heading, f, 3); add(out.font_weights, s.fontWeight); }
    else if (['P', 'BODY', 'LI'].includes(el.tagName)) add(out.fonts.body, f);
    add(out.font_sizes, s.fontSize);
    if (s.borderTopLeftRadius !== '0px') add(out.radii, s.borderTopLeftRadius);
    if (s.boxShadow !== 'none' && s.boxShadow.length <= 160) add(out.shadows, s.boxShadow);
    for (const v of [s.paddingTop, s.paddingLeft, s.rowGap, s.columnGap]) if (/^[1-9][\d.]*px$/.test(v)) add(out.spacing, v);
  }
  for (const sheet of [...document.styleSheets]) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; }
    for (const r of [...(rules || [])]) {
      if (!r.style || !/^(:root|html)$/.test((r.selectorText || '').trim())) continue;
      for (const name of [...r.style]) {
        const v = r.style.getPropertyValue(name).trim();
        if (name.startsWith('--') && v && v.length <= 200 && !/url\(|[<>{}]/.test(v) && Object.keys(out.custom_properties).length < 200) out.custom_properties[name] = v;
      }
    }
  }
  // Seções: blocos grandes de topo, classificados pela estrutura (contagens), não pelo texto.
  const vw = window.innerWidth;
  const roots = [...document.querySelectorAll('body > *, main > *, body > div > *, body > div > main > *')]
    .filter(el => { const r = el.getBoundingClientRect(); return r.height >= 120 && r.width >= vw * 0.6 && !['SCRIPT', 'STYLE', 'NAV', 'NOSCRIPT'].includes(el.tagName); });
  const leaves = roots.filter(el => !roots.some(o => o !== el && el.contains(o)));
  leaves.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
  const names = el => `${el.id} ${typeof el.className === 'string' ? el.className : ''} ${el.getAttribute('aria-label') || ''}`.toLowerCase();
  for (const [i, el] of leaves.entries()) {
    const n = names(el);
    const r = el.getBoundingClientRect();
    const imgs = el.querySelectorAll('img, picture, video, [style*="background-image"]').length;
    const heads = el.querySelectorAll('h2, h3, h4').length;
    const grid = [...el.querySelectorAll('*')].some(x => { const d = getComputedStyle(x); return (d.display === 'grid' || d.display === 'flex') && x.children.length >= 3; });
    let type = null;
    if (el.tagName === 'FOOTER') type = null;
    else if (i === 0 && (el.querySelector('h1') || r.height >= window.innerHeight * 0.5)) type = 'hero';
    else if (/faq|pergunt|duvid|accordion/.test(n) || el.querySelectorAll('details').length >= 2) type = 'faq';
    else if (/testimon|depoiment|review|avalia/.test(n) || el.querySelectorAll('blockquote').length >= 2) type = 'testimonials';
    else if (/team|equipe/.test(n)) type = 'team';
    else if (el.querySelector('form') || /contat|contact/.test(n)) type = 'contact';
    else if (/galer|gallery|portfolio/.test(n) || (imgs >= 6 && heads <= 2)) type = 'gallery';
    else if (/about|sobre/.test(n) || (imgs >= 1 && imgs <= 2 && heads <= 2 && !grid)) type = 'about';
    else if (grid && heads >= 3) type = 'services';
    else if (r.height < 420 && el.querySelector('a[class*="btn"], button, a[class*="button"]')) type = 'cta';
    out.blocks.push({ type: type || 'outro', top: Math.round(r.top + window.scrollY), height: Math.round(r.height), images: imgs, headings: heads, grid });
    if (type && !out.layout.includes(type)) out.layout.push(type);
  }
  return out;
}

async function design(target) {
  const { chromium } = require('playwright');
  const browser = await chromium.launch(launchOptions());
  const context = await newContext(browser);
  const sheets = [];
  context.on('response', async res => {
    try {
      if (res.status() !== 200 || sheets.length >= 30 || !/text\/css/.test(res.headers()['content-type'] || '')) return;
      const body = await res.body();
      if (body.length <= 1_000_000) sheets.push(body.toString('utf8'));
    } catch { /* corpo indisponível */ }
  });
  const page = await context.newPage();
  const res = await gotoPolite(page, target.url);
  if (!res || res.status() >= 400) fail(`a página não abriu (${res ? res.status() : 'sem resposta'})`, 1);
  await scrollAll(page);
  const tokens = cloner.emptyTokens();
  for (const css of sheets) cloner.parseCss(css, tokens);
  const html = await page.content();
  cloner.parseHtml(html, page.url(), tokens);
  const live = await page.evaluate(browserTokens);
  // Estilo final do navegador pesa mais que a contagem no CSS (que inclui regras não usadas).
  for (const [h, c] of Object.entries(live.colors)) {
    const cur = tokens.colors[h] || (tokens.colors[h] = { bg: 0, text: 0, border: 0, other: 0, button: 0 });
    for (const k of Object.keys(c)) cur[k] = (cur[k] || 0) + c[k] * 3;
  }
  for (const part of ['heading', 'body']) for (const [f, n] of Object.entries(live.fonts[part])) tokens.fonts[part][f] = (tokens.fonts[part][f] || 0) + n * 3;
  for (const k of ['font_sizes', 'font_weights', 'radii', 'shadows', 'spacing']) for (const [v, n] of Object.entries(live[k])) tokens[k][v] = (tokens[k][v] || 0) + n;
  Object.assign(tokens.custom_properties, live.custom_properties);
  if (live.layout.length >= 3) tokens.layout = live.layout;
  const base = cloner.designBase(tokens, { host: target.host });

  const dir = path.join(OUT, 'design');
  fs.mkdirSync(path.join(dir, 'fotos'), { recursive: true });
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(800);
    const full = await page.evaluate(() => document.documentElement.scrollHeight).catch(() => 900);
    await page.screenshot({ path: path.join(dir, 'fotos', `${width}.jpg`), type: 'jpeg', quality: 60, clip: { x: 0, y: 0, width, height: Math.min(full, 6000) }, fullPage: true });
  }
  await browser.close();

  const report = {
    gerado_por: 'NEXIA Clone (modo design)', fonte: { host: target.host, url: target.url, capturado_em: new Date().toISOString() },
    aviso: 'Só o design (tokens e ordem das seções). Textos, imagens, logos e código do site original NÃO foram copiados; as fotos de tela são só referência.',
    tokens: cloner.summarize(tokens), layout: live.blocks, spec_base: base,
  };
  fs.writeFileSync(path.join(dir, 'design.json'), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'spec-base.json'), `${JSON.stringify({ style: base.style, fonts: base.fonts, palette: base.palette, sections: base.sections, design_source: base.source }, null, 2)}\n`);
  const summary = { modo: 'design', host: target.host, estilo: base.style, fontes: base.fonts, secoes: base.sections.map(s => s.type), cores: Object.keys(tokens.colors).length };
  fs.writeFileSync(path.join(OUT, 'resultado.json'), JSON.stringify(summary));
  console.log('[clonar-site] ok', JSON.stringify(summary));
}

async function espelho(target) {
  if (!cloner.isAuthorized(process.env.AUTORIZADO)) fail(`modo espelho exige autorizado=${cloner.AUTH_TOKEN} (você declara ser dono do site ou ter autorização).`);
  const maxPages = cloner.maxPages(process.env.MAX_PAGINAS);
  // robots.txt: 2xx → regras; 404/410 → sem regras; outro erro → não copia (conservador).
  let robots;
  try {
    const r = await fetch(`${target.origin}/robots.txt`, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(15000) });
    if (r.ok) robots = cloner.parseRobots(await r.text());
    else if ([404, 410].includes(r.status)) robots = cloner.parseRobots('');
    else fail(`robots.txt respondeu ${r.status}; sem certeza de permissão, nada foi copiado.`, 1);
  } catch { fail('robots.txt não abriu; sem certeza de permissão, nada foi copiado.', 1); }
  const startPath = new URL(target.url).pathname + new URL(target.url).search;
  if (!robots.allowed(startPath)) fail('o robots.txt do site não permite copiar esta página; nada foi copiado.', 1);
  const delay = Math.max(1000, Math.min((robots.delay || 1) * 1000, 10000));

  const { chromium } = require('playwright');
  const browser = await chromium.launch(launchOptions());
  const context = await newContext(browser);
  const files = new Map();   // url → { type, body }
  let total = 0, skipped = 0;
  context.on('response', async res => {
    try {
      const req = res.request();
      const u = req.url();
      if (res.status() !== 200 || req.method() !== 'GET' || !/^https?:/.test(u) || req.resourceType() === 'document' || files.has(u)) return;
      const type = (res.headers()['content-type'] || '').split(';')[0].trim().toLowerCase();
      if (!SAVE_TYPES.test(type)) return;
      const body = await res.body();
      if (body.length > MAX_FILE || total + body.length > MAX_TOTAL) { skipped++; return; }
      total += body.length;
      files.set(u.split('#')[0], { type, body });
    } catch { /* corpo indisponível (redirecionamento, stream) */ }
  });
  const page = await context.newPage();
  const pages = [];
  const queue = [target.url];
  const seen = new Set(queue);
  while (queue.length && pages.length < maxPages) {
    const url = queue.shift();
    await context.clearCookies();
    const res = await gotoPolite(page, url);
    const finalUrl = page.url().split('#')[0];
    if (res && res.status() === 200 && new URL(finalUrl).origin === target.origin && robots.allowed(new URL(finalUrl).pathname)) {
      await scrollAll(page);
      const html = await page.content();
      pages.push({ url: finalUrl, requested: url, html });
      for (const link of cloner.sameOriginLinks(html, finalUrl, target.origin)) {
        const p = new URL(link);
        if (!seen.has(link) && robots.allowed(p.pathname + p.search) && seen.size < maxPages * 5) { seen.add(link); queue.push(link); }
      }
    }
    console.log(`[clonar-site] página ${pages.length}/${maxPages}`);
    await sleep(delay);
  }
  await browser.close();
  if (!pages.length) fail('nenhuma página pôde ser copiada.', 1);

  // Mapa URL → arquivo local (páginas com e sem barra no fim apontam para o mesmo arquivo).
  const local = new Map();
  for (const p of pages) for (const u of [p.url, p.requested]) {
    const file = cloner.localPath(p.url, target.origin, { page: true });
    local.set(u, file);
    local.set(u.endsWith('/') ? u.slice(0, -1) : `${u}/`, file);
  }
  for (const [u, f] of files) if (!local.has(u)) local.set(u, cloner.localPath(u, target.origin, { type: f.type }));
  const lookup = abs => local.get(abs) || local.get(abs.split('#')[0]);

  const dir = path.join(OUT, 'site');
  const write = (rel, data) => { const full = path.join(dir, rel); if (!full.startsWith(dir + path.sep)) return; fs.mkdirSync(path.dirname(full), { recursive: true }); fs.writeFileSync(full, data); };
  let forms = 0;
  for (const p of pages) {
    const file = local.get(p.url);
    const r = cloner.rewriteHtml(p.html, p.url, file, lookup);
    forms += r.forms;
    write(file, r.html);
  }
  for (const [u, f] of files) {
    const file = local.get(u);
    write(file, f.type === 'text/css' ? cloner.rewriteCss(f.body.toString('utf8'), u, file, lookup) : f.body);
  }
  write('LEIA-ME-NEXIA-CLONE.txt', [
    `Espelho de ${target.origin} feito pelo NEXIA Clone em ${new Date().toISOString()}.`,
    'Feito com a declaração do solicitante de que é dono do site ou tem autorização para copiá-lo.',
    `Páginas: ${pages.length}. Arquivos: ${files.size}. Formulários neutralizados: ${forms} (o envio para o servidor original foi removido).`,
    'Nenhum cookie, login ou credencial foi usado. Scripts do site original podem ainda chamar serviços externos.',
    'ATENÇÃO: este repositório é público; esta cópia fica pública.', '',
  ].join('\n'));
  const summary = { modo: 'espelho', host: target.host, paginas: pages.length, arquivos: files.size, ignorados_por_tamanho: skipped, formularios_neutralizados: forms, megabytes: Math.round(total / 1048576) };
  fs.writeFileSync(path.join(OUT, 'resultado.json'), JSON.stringify(summary));
  console.log('[clonar-site] ok', JSON.stringify(summary));
}

async function main() {
  if (!['design', 'espelho'].includes(MODO)) fail('MODO deve ser design ou espelho.');
  const v = cloner.validateUrl(process.env.CLONE_URL);
  if (!v.ok) fail(`URL recusada: ${v.error}.`);
  const dns = await cloner.checkResolved(v.host, cloner.defaultLookup());
  if (!dns.ok) fail(`URL recusada: ${dns.error}.`);
  fs.mkdirSync(OUT, { recursive: true });
  await (MODO === 'design' ? design(v) : espelho(v));
}

if (require.main === module) main().catch(e => { console.error('[clonar-site] falhou', e && e.name, e && e.message ? String(e.message).slice(0, 200) : ''); process.exit(1); });
module.exports = { browserTokens, newContext, main };
