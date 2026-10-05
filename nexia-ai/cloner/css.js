'use strict';
// Clonar site, modo design (ADR-CLONE-01): lê HTML e CSS como TEXTO (nunca executa) e tira só os tokens de
// design: cores, fontes, tamanhos, pesos, cantos, sombras, espaçamentos, variáveis CSS e a ordem das seções.
// Nenhum texto, imagem, logo ou código do site original sai daqui.

const NAMED = { white: '#ffffff', black: '#000000' };
const GENERIC = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-sans-serif|ui-serif|ui-monospace|ui-rounded|-apple-system|blinkmacsystemfont|emoji|math|fangsong|inherit|initial|unset|revert|var\(.*)$/i;
const ICON_FONT = /(awesome|icon|material symbols|remixicon|glyph|dashicons|eicons|slick|swiper|ionicons|feather|bootstrap-icons|fontello|icomoon|lucide|phosphor|tabler)/i;
const MAX_PROPS = 200;

const clamp = (n, a, b) => Math.min(Math.max(n, a), b);
const hex2 = n => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');

/** Cor CSS → '#rrggbb' (null se transparente, alfa < 0,5 ou formato desconhecido). */
function toHex(value) {
  const v = String(value || '').trim().toLowerCase();
  if (NAMED[v]) return NAMED[v];
  let m = /^#([0-9a-f]{3,8})$/.exec(v);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = h.split('').map(c => c + c).join('');
    if (h.length === 8) { if (parseInt(h.slice(6), 16) < 128) return null; h = h.slice(0, 6); }
    return h.length === 6 ? `#${h}` : null;
  }
  m = /^rgba?\(\s*([\d.]+%?)[\s,]+([\d.]+%?)[\s,]+([\d.]+%?)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(v);
  if (m) {
    const ch = s => (s.endsWith('%') ? parseFloat(s) * 2.55 : parseFloat(s));
    const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return a < 0.5 ? null : `#${hex2(ch(m[1]))}${hex2(ch(m[2]))}${hex2(ch(m[3]))}`;
  }
  m = /^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(v);
  if (m) {
    const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    if (a < 0.5) return null;
    const [r, g, b] = hslToRgb(parseFloat(m[1]) % 360, parseFloat(m[2]) / 100, parseFloat(m[3]) / 100);
    return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
  }
  return null;
}

function hslToRgb(h, s, l) {
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

const COLOR_RE = /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|\b(?:white|black)\b/gi;

/** Primeira família "de verdade" de um font-family (sem genéricas, var() e fontes de ícone). */
function firstFamily(value) {
  for (const part of String(value || '').split(',')) {
    const name = part.trim().replace(/^["']|["']$/g, '').replace(/\s+/g, ' ').trim();
    if (!name || GENERIC.test(name) || ICON_FONT.test(name) || !/^[A-Za-z0-9 _-]{2,40}$/.test(name)) continue;
    return name;
  }
  return null;
}

function emptyTokens() {
  return { colors: {}, custom_properties: {}, fonts: { heading: {}, body: {}, declared: [] }, font_sizes: {}, font_weights: {},
    radii: {}, shadows: {}, spacing: {}, layout: [] };
}
const bump = (map, key, n = 1) => { if (key) map[key] = (map[key] || 0) + n; };

/** Resolve var(--x, fallback) com as variáveis já lidas (até 4 níveis). */
function resolveVars(value, props, depth = 0) {
  if (depth > 4 || !/var\(/.test(value)) return value;
  return resolveVars(value.replace(/var\(\s*(--[A-Za-z0-9_-]+)\s*(?:,\s*([^()]*(?:\([^()]*\))?[^()]*))?\)/g,
    (_, name, fb) => (props[name] !== undefined ? props[name] : (fb || '').trim())), props, depth + 1);
}

const roleOf = prop => (/^background(-color)?$/.test(prop) ? 'bg' : prop === 'color' ? 'text' : /^border/.test(prop) || prop === 'outline-color' ? 'border' : 'other');

/**
 * Lê um CSS (texto) e soma nos tokens. Regras mais internas (dentro de @media) também contam.
 * @param {string} css
 * @param {object} [tokens]  acumulador (emptyTokens())
 */
function parseCss(css, tokens = emptyTokens()) {
  const text = String(css || '').replace(/\/\*[\s\S]*?\*\//g, '').slice(0, 3_000_000);
  const rules = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(text))) rules.push([m[1].trim(), m[2]]);
  // 1ª passada: variáveis (para resolver var() na 2ª). Vale a primeira definição; a do :root vence.
  for (const [sel, body] of rules) {
    if (sel.startsWith('@')) continue;
    const root = /^\s*(:root|html)\s*$/i.test(sel);
    for (const d of body.split(';')) {
      const i = d.indexOf(':');
      if (i < 0) continue;
      const name = d.slice(0, i).trim();
      if (!/^--[A-Za-z0-9_-]{1,60}$/.test(name)) continue;
      if (tokens.custom_properties[name] !== undefined && !root) continue;
      if (Object.keys(tokens.custom_properties).length >= MAX_PROPS && tokens.custom_properties[name] === undefined) continue;
      const val = d.slice(i + 1).trim().replace(/\s*!important$/, '').slice(0, 200);
      // Só valores de design (cor, tamanho, fonte, sombra); nada de url() nem texto entre aspas (exceto lista de fontes).
      if (!val || /url\(|expression|javascript:|[<>{}]/i.test(val) || (/["']/.test(val) && !/,|serif|sans|mono/i.test(val))) continue;
      tokens.custom_properties[name] = val;
    }
  }
  const props = tokens.custom_properties;
  for (const [sel, body] of rules) {
    if (sel.startsWith('@font-face')) {
      const fm = /font-family\s*:\s*([^;]+)/i.exec(body);
      const fam = fm && firstFamily(fm[1]);
      if (fam && !tokens.fonts.declared.includes(fam) && tokens.fonts.declared.length < 30) tokens.fonts.declared.push(fam);
      continue;
    }
    if (sel.startsWith('@')) continue;
    const isHeading = /(^|[\s,>+~])h[1-3]\b|heading|title|display|headline|hero/i.test(sel);
    const isBody = /(^|,)\s*(html|body|:root|p)\s*($|,)/i.test(sel);
    const isButton = /\b(btn|button|cta)\b|(^|[\s,])button\b|\[type=.?submit/i.test(sel);
    for (const d of body.split(';')) {
      const i = d.indexOf(':');
      if (i < 0) continue;
      const prop = d.slice(0, i).trim().toLowerCase();
      if (prop.startsWith('--')) continue;
      const value = resolveVars(d.slice(i + 1).trim().replace(/\s*!important$/, ''), props);
      if (/^(color|background|background-color|border|border-color|border-top|border-bottom|outline-color|fill|stroke)$/.test(prop)) {
        for (const c of value.match(COLOR_RE) || []) {
          const h = toHex(c);
          if (!h) continue;
          tokens.colors[h] = tokens.colors[h] || { bg: 0, text: 0, border: 0, other: 0, button: 0 };
          tokens.colors[h][roleOf(prop)]++;
          if (isButton && /^background/.test(prop)) tokens.colors[h].button++;
        }
      } else if (prop === 'font-family' || prop === 'font') {
        const fam = firstFamily(prop === 'font' ? value.replace(/^.*?\d[\w.%]*(\/[\w.%]+)?\s+/, '') : value);
        if (fam) bump(isHeading ? tokens.fonts.heading : tokens.fonts.body, fam, isBody || isHeading ? 3 : 1);
      } else if (prop === 'font-size') {
        if (/^[\d.]+(px|rem|em)$/.test(value)) bump(tokens.font_sizes, value);
      } else if (prop === 'font-weight') {
        if (/^[1-9]00$|^bold$|^normal$/.test(value)) bump(tokens.font_weights, value === 'bold' ? '700' : value === 'normal' ? '400' : value);
      } else if (/^border(-[a-z]+)*-radius$/.test(prop)) {
        if (/^[\d.]+(px|rem|em|%)$/.test(value)) bump(tokens.radii, value);
      } else if (prop === 'box-shadow') {
        if (value !== 'none' && value.length <= 160 && !/url\(/.test(value)) bump(tokens.shadows, value);
      } else if (/^(padding|margin|gap|row-gap|column-gap)(-[a-z]+)?$/.test(prop)) {
        for (const v of value.split(/\s+/)) if (/^[1-9][\d.]*(px|rem)$/.test(v)) bump(tokens.spacing, v);
      }
    }
  }
  return tokens;
}

// Seções pelo id/classe dos blocos (só a estrutura; nenhum texto do site é guardado).
const SECTION_HINTS = [
  ['hero', /\b(hero|banner|jumbotron|masthead|intro|showcase|splash|cover|destaque)\b/],
  ['testimonials', /\b(testimonial|testimonials|depoimento|depoimentos|review|reviews|avaliac|quotes?)\b/],
  ['faq', /\b(faq|faqs|perguntas|duvidas|accordion|questions)\b/],
  ['gallery', /\b(gallery|galeria|portfolio|works|projetos|fotos|photos|instagram)\b/],
  ['team', /\b(team|equipe|time|staff|people|profissionais)\b/],
  ['about', /\b(about|sobre|quem-somos|history|historia|story|mission)\b/],
  ['services', /\b(services|servicos|features|recursos|cards|produtos|products|pricing|planos|benefits|beneficios|solutions|solucoes|tratamentos|cardapio|menu-items)\b/],
  ['cta', /\b(cta|call-to-action|newsletter|signup|subscribe|agende|banner-cta)\b/],
  ['contact', /\b(contact|contato|contatos|fale|location|localizacao|endereco|map|mapa)\b/],
];

/** Tipos de seção na ordem em que aparecem no HTML (pelo id/classe/aria dos blocos e por sinais da estrutura). */
function guessLayout(html) {
  const h = String(html || '').slice(0, 2_000_000).replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  const found = [];
  const re = /<(section|header|div|article|aside|footer|main)\b([^>]*)>/gi;
  let m;
  while ((m = re.exec(h))) {
    const attrs = m[2].toLowerCase();
    const names = [...attrs.matchAll(/\b(?:id|class|aria-label|data-section)\s*=\s*["']([^"']{1,200})["']/g)].map(x => x[1]).join(' ')
      .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/_/g, '-');
    if (!names) continue;
    const hit = SECTION_HINTS.find(([, rx]) => rx.test(names));
    // footer com "mapa"/"endereço" é rodapé, não seção de contato
    if (hit && !(m[1] === 'footer' && hit[0] === 'contact')) found.push([m.index, hit[0]]);
  }
  if (/<details\b/i.test(h)) found.push([h.search(/<details\b/i), 'faq']);
  if (/<blockquote\b/i.test(h)) found.push([h.search(/<blockquote\b/i), 'testimonials']);
  if (/<form\b/i.test(h)) found.push([h.search(/<form\b/i), 'contact']);
  if (/<h1\b/i.test(h) && !found.some(f => f[1] === 'hero')) found.push([h.search(/<h1\b/i), 'hero']);
  const order = [];
  for (const [, type] of found.sort((a, b) => a[0] - b[0])) if (!order.includes(type)) order.push(type);
  return order.slice(0, 12);
}

/** Folhas de estilo e famílias do Google Fonts citadas no HTML. */
function linkedAssets(html, baseUrl) {
  const h = String(html || '').slice(0, 2_000_000);
  const css = [], googleFonts = [];
  for (const m of h.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/rel\s*=\s*["']?[^"'>]*stylesheet/i.test(tag)) continue;
    const href = /href\s*=\s*["']([^"']+)["']/i.exec(tag);
    if (!href) continue;
    let abs;
    try { abs = new URL(href[1].replace(/&amp;/g, '&'), baseUrl).href; } catch { continue; }
    if (/fonts\.googleapis\.com/.test(abs)) {
      for (const f of new URL(abs).searchParams.getAll('family')) for (const fam of f.split('|')) googleFonts.push(fam.split(':')[0].replace(/\+/g, ' ').trim());
      continue;
    }
    if (/^https?:/.test(abs)) css.push(abs);
  }
  for (const m of h.matchAll(/@import\s+(?:url\()?["']([^"')]+)["']/gi)) {
    if (/fonts\.googleapis\.com/.test(m[1])) {
      try { for (const f of new URL(m[1], baseUrl).searchParams.getAll('family')) googleFonts.push(f.split(':')[0].replace(/\+/g, ' ').trim()); } catch { /* ignora */ }
    }
  }
  return { css: [...new Set(css)], googleFonts: [...new Set(googleFonts.filter(f => /^[A-Za-z0-9 ]{2,40}$/.test(f)))] };
}

/** HTML: <style> e style="" entram como CSS; layout e Google Fonts à parte. */
function parseHtml(html, baseUrl, tokens = emptyTokens()) {
  const h = String(html || '').slice(0, 2_000_000);
  for (const m of h.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) parseCss(m[1], tokens);
  const inline = [...h.matchAll(/\sstyle\s*=\s*"([^"]{1,500})"/gi)].slice(0, 400).map(m => `x{${m[1].replace(/&quot;/g, '"')}}`).join('\n');
  if (inline) parseCss(inline, tokens);
  const { css, googleFonts } = linkedAssets(h, baseUrl);
  for (const f of googleFonts) if (!tokens.fonts.declared.includes(f)) tokens.fonts.declared.push(f);
  tokens.layout = guessLayout(h);
  return { tokens, css, googleFonts };
}

const top = (map, n) => Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, n);

/** Tokens em forma de relatório (listas ordenadas pela frequência). */
function summarize(tokens) {
  return {
    colors: top(Object.fromEntries(Object.entries(tokens.colors).map(([k, v]) => [k, v.bg + v.text + v.border + v.other])), 24)
      .map(([hex, count]) => ({ hex, count, ...tokens.colors[hex] })),
    custom_properties: Object.fromEntries(Object.entries(tokens.custom_properties).slice(0, MAX_PROPS)),
    fonts: { heading: top(tokens.fonts.heading, 5).map(([name, count]) => ({ name, count })), body: top(tokens.fonts.body, 5).map(([name, count]) => ({ name, count })),
      declared: tokens.fonts.declared.slice(0, 30) },
    font_sizes: top(tokens.font_sizes, 12).map(([value, count]) => ({ value, count })),
    font_weights: top(tokens.font_weights, 6).map(([value, count]) => ({ value, count })),
    radii: top(tokens.radii, 8).map(([value, count]) => ({ value, count })),
    shadows: top(tokens.shadows, 6).map(([value, count]) => ({ value, count })),
    spacing: top(tokens.spacing, 12).map(([value, count]) => ({ value, count })),
    layout: tokens.layout,
  };
}

module.exports = { toHex, firstFamily, emptyTokens, parseCss, parseHtml, guessLayout, linkedAssets, resolveVars, summarize, COLOR_RE };
