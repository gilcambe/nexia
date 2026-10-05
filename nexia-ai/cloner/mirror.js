'use strict';
// Clonar site, modo espelho (ADR-CLONE-01): só com autorização explícita do dono e com o robots.txt
// permitindo. Partes puras (testáveis sem navegador): robots.txt, caminho local de cada URL, reescrita
// de links em HTML/CSS para caminhos relativos e formulários neutralizados.

const path = require('path').posix;
const crypto = require('crypto');

const AUTH_TOKEN = 'SOU_DONO_OU_AUTORIZADO';
const DEFAULT_MAX_PAGES = 20;
const HARD_MAX_PAGES = 200;

/** Confere a declaração de autorização (texto exato). */
const isAuthorized = v => String(v || '').trim() === AUTH_TOKEN;

/**
 * robots.txt → função (caminho) → permitido? Grupo do nosso agente ("nexia-clone") ou, sem ele, o "*".
 * Regra mais longa vence; empate favorece Allow. Suporta * e $. Também devolve o Crawl-delay.
 */
function parseRobots(text, agent = 'nexia-clone') {
  const groups = [];
  let cur = null, lastWasAgent = false;
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase(), val = m[2].trim();
    if (key === 'user-agent') {
      if (!lastWasAgent) { cur = { agents: [], rules: [], delay: null }; groups.push(cur); }
      cur.agents.push(val.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!cur) continue;
    if (key === 'allow' || key === 'disallow') { if (val || key === 'allow') cur.rules.push({ allow: key === 'allow', path: val }); }
    else if (key === 'crawl-delay' && Number.isFinite(Number(val))) cur.delay = Number(val);
  }
  const mine = groups.filter(g => g.agents.some(a => a !== '*' && agent.toLowerCase().startsWith(a)));
  const chosen = mine.length ? mine : groups.filter(g => g.agents.includes('*'));
  const rules = chosen.flatMap(g => g.rules).filter(r => r.path);
  const delay = chosen.map(g => g.delay).find(d => d !== null) ?? null;
  const toRe = p => new RegExp(`^${p.replace(/[.+?^{}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$|\$$/, '$')}`);
  const compiled = rules.map(r => ({ ...r, re: toRe(r.path), len: r.path.length }));
  const allowed = p => {
    let best = null;
    for (const r of compiled) if (r.re.test(p) && (!best || r.len > best.len || (r.len === best.len && r.allow))) best = r;
    return !best || best.allow;
  };
  return { allowed, delay };
}

const EXT_BY_TYPE = { 'text/html': '.html', 'text/css': '.css', 'text/javascript': '.js', 'application/javascript': '.js', 'image/png': '.png', 'image/jpeg': '.jpg',
  'image/webp': '.webp', 'image/gif': '.gif', 'image/svg+xml': '.svg', 'image/avif': '.avif', 'image/x-icon': '.ico', 'font/woff2': '.woff2', 'font/woff': '.woff',
  'font/ttf': '.ttf', 'font/otf': '.otf', 'video/mp4': '.mp4', 'video/webm': '.webm', 'application/json': '.json', 'application/manifest+json': '.json' };

const safeSeg = s => decodeURIComponentSafe(s).replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^\.+/, '_').slice(0, 80) || '_';
function decodeURIComponentSafe(s) { try { return decodeURIComponent(s); } catch { return s; } }

/**
 * Caminho local (relativo à raiz do espelho) de uma URL.
 *  - mesma origem: /sobre → sobre/index.html; /a/b.css → a/b.css; com ?query → nome com hash curto
 *  - outra origem (CDN de fontes/imagens): _ext/<host>/<caminho>
 * @param {string} url
 * @param {string} origin  origem do site espelhado
 * @param {{ page?: boolean, type?: string }} [o]
 */
function localPath(url, origin, { page = false, type = '' } = {}) {
  const u = new URL(url);
  const segs = u.pathname.split('/').filter(Boolean).map(safeSeg);
  const prefix = u.origin === origin ? [] : ['_ext', safeSeg(u.host)];
  const q = u.search ? `-${crypto.createHash('sha1').update(u.search).digest('hex').slice(0, 8)}` : '';
  const mime = String(type).split(';')[0].trim().toLowerCase();
  let file;
  if (page || mime === 'text/html') {
    const last = segs[segs.length - 1] || '';
    if (/\.html?$/i.test(last)) { segs.pop(); file = last.replace(/\.html?$/i, `${q}.html`); }
    else file = q ? `index${q}.html` : 'index.html';
  } else {
    file = segs.pop() || 'index';
    const ext = path.extname(file);
    const want = EXT_BY_TYPE[mime];
    if (!ext && want) file += want;
    if (q) file = file.replace(/(\.[A-Za-z0-9]+)?$/, m => `${q}${m}`);
  }
  return [...prefix, ...segs, file].join('/');
}

/** Caminho relativo de um arquivo local para outro (para usar em href/src). */
function relative(fromFile, toFile) {
  const r = path.relative(path.dirname(`/${fromFile}`), `/${toFile}`);
  return r || path.basename(toFile);
}

const ATTR_RE = /(\s(?:src|href|poster|data-src|data-href|action|data-bg|data-background)\s*=\s*)(["'])([^"']*)\2/gi;
const SRCSET_RE = /(\s(?:srcset|data-srcset)\s*=\s*)(["'])([^"']*)\2/gi;

/**
 * Troca uma URL (como escrita no documento) pelo caminho relativo do arquivo salvo, se ele existir no mapa.
 * @param {string} ref
 * @param {string} baseUrl  URL do documento
 * @param {string} fromFile caminho local do documento
 * @param {(abs: string) => string|undefined} lookup  URL absoluta → caminho local salvo
 */
function rewriteRef(ref, baseUrl, fromFile, lookup) {
  const r = String(ref || '').trim();
  if (!r || /^(#|data:|mailto:|tel:|javascript:|blob:|about:)/i.test(r)) return ref;
  let abs;
  try { abs = new URL(r.replace(/&amp;/g, '&'), baseUrl); } catch { return ref; }
  const hash = abs.hash;
  abs.hash = '';
  const local = lookup(abs.href);
  if (local) return `${relative(fromFile, local)}${hash}`;
  // Não copiado (fora do limite, robots.txt ou erro): aponta para o original em vez de quebrar.
  return /^https?:$/.test(abs.protocol) ? `${abs.href}${hash}` : ref;
}

/** CSS: url(...) e @import "..." apontando para os arquivos salvos. */
function rewriteCss(css, baseUrl, fromFile, lookup) {
  return String(css || '')
    .replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi, (m, q, ref) => `url(${q}${rewriteRef(ref, baseUrl, fromFile, lookup)}${q})`)
    .replace(/@import\s+(["'])([^"']+)\1/gi, (m, q, ref) => `@import ${q}${rewriteRef(ref, baseUrl, fromFile, lookup)}${q}`);
}

const FORM_NOTE = '<p class="nexia-clone-aviso" style="margin:.5rem 0;padding:.5rem .75rem;border:1px solid #d97706;background:#fffbeb;color:#78350f;font:14px/1.4 system-ui,sans-serif;border-radius:6px">Formulário desativado nesta cópia (NEXIA Clone): ele enviava para o servidor do site original. Ligue-o ao seu próprio backend.</p>';

/** Formulários: tira action/formaction/method e põe um aviso visível; envio fica bloqueado. */
function neutralizeForms(html) {
  let count = 0;
  const out = String(html || '')
    .replace(/<form\b([^>]*)>/gi, (m, attrs) => {
      count++;
      const clean = attrs.replace(/\s(?:action|method|target)\s*=\s*(["'])[^"']*\1/gi, '').replace(/\s(?:action|method|target)\s*=\s*[^\s>]+/gi, '');
      return `<form${clean} data-nexia-form-neutralizado="1" onsubmit="return false">${FORM_NOTE}`;
    })
    .replace(/\sformaction\s*=\s*(["'])[^"']*\1/gi, '');
  return { html: out, forms: count };
}

/**
 * HTML renderizado → HTML do espelho: links e mídias para caminhos relativos (src, href, srcset, poster,
 * style e <style>), sem <base>, sem integrity (os arquivos reescritos mudam o hash), formulários neutralizados
 * e um comentário dizendo de onde veio.
 */
function rewriteHtml(html, pageUrl, fromFile, lookup) {
  let h = String(html || '');
  h = h.replace(/<base\b[^>]*>/gi, '');
  h = h.replace(/\s(?:integrity|nonce)\s*=\s*(["'])[^"']*\1/gi, '');
  h = h.replace(ATTR_RE, (m, pre, q, ref) => `${pre}${q}${/^\s*action/i.test(pre) ? ref : rewriteRef(ref, pageUrl, fromFile, lookup)}${q}`);
  h = h.replace(SRCSET_RE, (m, pre, q, list) => `${pre}${q}${list.split(',').map(part => {
    const [ref, ...desc] = part.trim().split(/\s+/);
    return [rewriteRef(ref, pageUrl, fromFile, lookup), ...desc].join(' ');
  }).join(', ')}${q}`);
  h = h.replace(/(\sstyle\s*=\s*)(["'])([^"']*)\2/gi, (m, pre, q, css) => `${pre}${q}${rewriteCss(css.replace(/&quot;/g, '"'), pageUrl, fromFile, lookup).replace(/"/g, q === '"' ? '&quot;' : '"')}${q}`);
  h = h.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (m, a, css, b) => `${a}${rewriteCss(css, pageUrl, fromFile, lookup)}${b}`);
  // O DOM é salvo em UTF-8: a declaração de charset precisa dizer isso.
  h = h.replace(/<meta\b[^>]*charset\s*=\s*["']?[^"'\s>;]+["']?[^>]*>/gi, '');
  h = /<head\b[^>]*>/i.test(h) ? h.replace(/<head\b[^>]*>/i, m => `${m}<meta charset="utf-8">`) : `<meta charset="utf-8">${h}`;
  const f = neutralizeForms(h);
  const note = `<!-- Espelho feito pelo NEXIA Clone a partir de ${pageUrl.replace(/--/g, '-')} com autorização declarada do dono. -->\n`;
  return { html: /^\s*<!doctype/i.test(f.html) ? f.html.replace(/^(\s*<!doctype[^>]*>\s*)/i, `$1${note}`) : note + f.html, forms: f.forms };
}

/** Links de páginas da mesma origem no HTML (para o rastreamento em largura). */
function sameOriginLinks(html, pageUrl, origin) {
  const out = new Set();
  for (const m of String(html || '').matchAll(/<a\b[^>]*\shref\s*=\s*(["'])([^"']+)\1/gi)) {
    let u;
    try { u = new URL(m[2].replace(/&amp;/g, '&'), pageUrl); } catch { continue; }
    if (u.origin !== origin || !/^https?:$/.test(u.protocol)) continue;
    if (/\.(pdf|zip|rar|7z|gz|exe|dmg|mp3|mp4|webm|mov|avi|png|jpe?g|gif|webp|svg|ico|css|js|json|xml|txt)$/i.test(u.pathname)) continue;
    if (/(^|\/)(wp-admin|wp-login|login|logout|signin|sign-in|entrar|sair|admin|cart|carrinho|checkout|minha-conta|my-account)(\/|$)/i.test(u.pathname)) continue;
    u.hash = '';
    out.add(u.href);
  }
  return [...out];
}

/** Espera depois de 429/503: Retry-After (segundos) ou 5 s × 2^tentativa, no máximo 60 s. */
function backoffMs(retryAfter, attempt) {
  const s = Number(retryAfter);
  if (Number.isFinite(s) && s >= 0) return Math.min(s, 60) * 1000;
  return Math.min(5000 * 2 ** attempt, 60000);
}

/** max_paginas do workflow → inteiro entre 1 e 200 (padrão 20). */
function maxPages(v) {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n >= 1 ? Math.min(n, HARD_MAX_PAGES) : DEFAULT_MAX_PAGES;
}

/** Pasta de destino no repositório: clones/<host> ou a pedida (sem .., sem começar com ponto). */
function targetFolder(pasta, host) {
  const clean = String(pasta || '').trim().replace(/^\/+|\/+$/g, '');
  if (clean && /^[A-Za-z0-9._/-]{1,120}$/.test(clean) && !clean.split('/').some(p => !p || p === '..' || p.startsWith('.'))) return clean;
  return `clones/${String(host || 'site').toLowerCase().replace(/[^a-z0-9.-]+/g, '-').replace(/^\.+/, '')}`;
}

module.exports = { AUTH_TOKEN, DEFAULT_MAX_PAGES, isAuthorized, parseRobots, localPath, relative, rewriteRef, rewriteCss, rewriteHtml, neutralizeForms,
  sameOriginLinks, backoffMs, maxPages, targetFolder };
