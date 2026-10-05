'use strict';
// Clonar site, modo design (ADR-CLONE-01): tokens extraídos → base visual do NEXIA Site Kit (spec parcial:
// palette primary/accent/bg/surface/text/muted/dark, fonts heading/body da lista curada, style e ordem das
// seções). Só escolhas visuais; o conteúdo do site novo é do usuário (ou da IA, marcado para trocar).

const { toHex, resolveVars } = require('./css');

// Listas curadas do kit (as mesmas do prompt do Designer). Se o kit passar a exportar as dele, valem as do kit.
const kit = (() => { try { return require('../site-kit'); } catch { return {}; } })();
const HEADING_FONTS = Array.isArray(kit.HEADING_FONTS) && kit.HEADING_FONTS.length ? kit.HEADING_FONTS
  : ['Fraunces', 'Playfair Display', 'DM Serif Display', 'Sora', 'Outfit', 'Plus Jakarta Sans'];
const BODY_FONTS = Array.isArray(kit.BODY_FONTS) && kit.BODY_FONTS.length ? kit.BODY_FONTS : ['Inter', 'DM Sans', 'Manrope', 'Nunito Sans'];
const SECTION_TYPES = kit.SECTION_TYPES || ['hero', 'services', 'about', 'gallery', 'team', 'testimonials', 'faq', 'cta', 'contact'];

// Família → categoria (serif, script, display, geometric, grotesque, rounded).
const CATEGORY = {};
const put = (cat, names) => names.split(',').forEach(n => { CATEGORY[n.trim()] = cat; });
put('serif', 'georgia,times,times new roman,merriweather,lora,playfair display,playfair,libre baskerville,cormorant,cormorant garamond,eb garamond,garamond,pt serif,noto serif,source serif pro,source serif 4,crimson text,crimson pro,fraunces,dm serif display,dm serif text,abril fatface,prata,spectral,bitter,roboto slab,zilla slab,arvo,domine,cardo,libre caslon text,libre caslon display,baskerville,bodoni moda,marcellus,cinzel,tinos,gelasio,newsreader,instrument serif,young serif,literata,alegreya,vollkorn');
put('script', 'dancing script,pacifico,great vibes,lobster,sacramento,satisfy,allura,parisienne,caveat,kaushan script,amatic sc');
put('display', 'oswald,bebas neue,anton,archivo black,league gothic,barlow condensed,fjalla one,teko,bungee,alfa slab one,staatliches,big shoulders display,saira condensed,passion one');
put('geometric', 'montserrat,poppins,futura,futura pt,gotham,avenir,avenir next,raleway,outfit,sora,josefin sans,urbanist,lexend,space grotesk,syne,red hat display,kanit,questrial,jost,league spartan,dm sans,figtree,century gothic,proxima nova,gilroy,circular,product sans,google sans');
put('grotesque', 'helvetica,helvetica neue,arial,roboto,inter,open sans,lato,source sans pro,source sans 3,segoe ui,sf pro,sf pro display,sf pro text,work sans,ibm plex sans,noto sans,pt sans,public sans,manrope,plus jakarta sans,rubik,karla,archivo,barlow,mulish,hind,heebo,assistant,libre franklin,be vietnam pro,onest,geist,albert sans,schibsted grotesk,roboto flex,fira sans,ubuntu,cabin,overpass,titillium web,exo 2,verdana,tahoma,trebuchet ms');
put('rounded', 'nunito,nunito sans,quicksand,varela round,comfortaa,m plus rounded 1c,baloo 2,fredoka,mali,arial rounded mt bold');
const NEAR = { serif: ['serif', 'grotesque'], script: ['serif', 'grotesque'], display: ['geometric', 'grotesque'], geometric: ['geometric', 'grotesque'],
  grotesque: ['grotesque', 'geometric'], rounded: ['rounded', 'geometric', 'grotesque'] };

/** Categoria de uma família (conhecida ou pelo nome). */
function fontCategory(name) {
  const n = String(name || '').toLowerCase().trim();
  if (CATEGORY[n]) return CATEGORY[n];
  if (/script|hand|brush|signature/.test(n)) return 'script';
  if (/round/.test(n)) return 'rounded';
  if (/condensed|narrow|compressed|gothic|black|display(?!.*serif)/.test(n) && !/serif/.test(n)) return 'display';
  if (/(?<!sans )serif|slab|garamond|baskerville|caslon|bodoni|didot|times/.test(n)) return 'serif';
  return 'grotesque';
}

/**
 * Fonte curada mais próxima: a mesma (sem diferenciar maiúsculas), senão a primeira da lista com a mesma
 * categoria, senão a da categoria vizinha, senão a primeira da lista.
 */
function closestFont(name, list) {
  const exact = list.find(f => f.toLowerCase() === String(name || '').toLowerCase().trim());
  if (exact) return exact;
  const cat = fontCategory(name);
  for (const c of NEAR[cat] || ['grotesque']) {
    const hit = list.find(f => fontCategory(f) === c);
    if (hit) return hit;
  }
  return list[0];
}

// ── Cores ──
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
function luminance(hex) {
  const [r, g, b] = rgb(hex).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
function hsl(hex) {
  const [r, g, b] = rgb(hex);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}
const mix = (a, b, t) => `#${rgb(a).map((c, i) => Math.round((c * (1 - t) + rgb(b)[i] * t) * 255).toString(16).padStart(2, '0')).join('')}`;
const hueDist = (a, b) => { const d = Math.abs(hsl(a).h - hsl(b).h); return Math.min(d, 360 - d); };
const saturated = hex => { const c = hsl(hex); return c.s >= 0.35 && c.l >= 0.18 && c.l <= 0.78; };

// Variáveis CSS com nome de papel (ex.: --primary, --color-brand) valem mais que a contagem.
const VAR_ROLES = [
  ['primary', /(^|-)(primary|brand|main|theme)(-color|-500|-600)?$/],
  ['accent', /(^|-)(accent|secondary|highlight|tertiary)(-color|-500)?$/],
  ['bg', /(^|-)(bg|background|body-bg|page-bg|base)(-color)?$/],
  ['surface', /(^|-)(surface|card|panel|card-bg|surface-color)(-bg|-color)?$/],
  ['text', /(^|-)(text|foreground|fg|body-color|text-color|ink)(-color|-primary)?$/],
  ['muted', /(^|-)(muted|subtle|text-secondary|text-muted|gray-600|grey-600)(-color)?$/],
  ['dark', /(^|-)(dark|footer-bg|navy|darker)(-color|-bg)?$/],
];

function fromVars(props) {
  const out = {};
  for (const [name, raw] of Object.entries(props || {})) {
    const hex = toHex(resolveVars(String(raw), props));
    if (!hex) continue;
    const n = name.toLowerCase().replace(/^--/, '').replace(/^(color|clr|c|wp--preset--color)-+/, '');
    const role = VAR_ROLES.find(([, re]) => re.test(n));
    if (role && !out[role[0]]) out[role[0]] = hex;
  }
  return out;
}

// Cores padrão do navegador (link, visitado, ativo): não são escolha do site.
const UA_DEFAULTS = ['#0000ee', '#551a8b', '#ee0000'];
const DEFAULT_PALETTE = { primary: '#1f6f5c', accent: '#f2a541', bg: '#fbfaf7', surface: '#ffffff', text: '#1d2426', muted: '#5d6b6e', dark: '#12201d' };

/**
 * Paleta do kit a partir das cores contadas (fundo, texto, bordas, botões) e das variáveis CSS.
 * O kit pressupõe fundo claro e texto escuro: site escuro vira fundo claro com o escuro no "dark".
 */
function derivePalette(tokens) {
  const colors = Object.entries(tokens.colors || {}).filter(([hex]) => !UA_DEFAULTS.includes(hex)).map(([hex, c]) => ({ hex, ...c, total: (c.bg || 0) + (c.text || 0) + (c.border || 0) + (c.other || 0) }));
  const by = (k, f) => colors.filter(f).sort((a, b) => (b[k] - a[k]) || (b.total - a.total)).map(c => c.hex);
  const v = fromVars(tokens.custom_properties);
  const p = {};
  const lightBgs = by('bg', c => c.bg > 0 && luminance(c.hex) > 0.8);
  const darkBgs = by('bg', c => c.bg > 0 && luminance(c.hex) < 0.08);
  const mainBg = by('bg', c => c.bg > 0)[0];
  const siteIsDark = (v.bg && luminance(v.bg) < 0.2) || (!v.bg && mainBg && luminance(mainBg) < 0.2 && !lightBgs.length);
  p.bg = (v.bg && luminance(v.bg) > 0.8 && v.bg) || lightBgs[0] || null;
  p.surface = (v.surface && luminance(v.surface) > 0.8 && v.surface) || lightBgs.find(h => h !== p.bg) || null;
  const accents = [...new Set([v.primary, ...by('button', c => c.button > 0 && saturated(c.hex)), ...by('total', c => saturated(c.hex)), v.accent].filter(h => h && saturated(h)))];
  p.primary = (v.primary && saturated(v.primary) && v.primary) || accents[0] || null;
  p.accent = (v.accent && saturated(v.accent) && v.accent !== p.primary && v.accent) || accents.find(h => p.primary && hueDist(h, p.primary) >= 30) || null;
  const inkish = h => luminance(h) < 0.2 && hsl(h).s < 0.45;
  p.text = (v.text && inkish(v.text) && v.text) || by('text', c => c.text > 0 && inkish(c.hex))[0] || null;
  p.muted = (v.muted && hsl(v.muted).s < 0.25 && v.muted) || by('text', c => c.text > 0 && hsl(c.hex).s < 0.25 && luminance(c.hex) >= 0.08 && luminance(c.hex) <= 0.45)[0] || null;
  p.dark = (v.dark && luminance(v.dark) < 0.08 && v.dark) || (siteIsDark && mainBg) || darkBgs[0] || null;

  const out = { ...DEFAULT_PALETTE };
  if (p.primary) out.primary = p.primary;
  if (p.accent) out.accent = p.accent;
  else if (p.primary) out.accent = mix(p.primary, hsl(p.primary).l > 0.5 ? '#000000' : '#ffffff', 0.35);
  out.bg = p.bg || (siteIsDark ? mix(out.primary, '#ffffff', 0.94) : DEFAULT_PALETTE.bg);
  out.surface = p.surface || '#ffffff';
  out.text = p.text || DEFAULT_PALETTE.text;
  out.dark = p.dark || mix(out.primary, '#000000', 0.75);
  out.muted = p.muted || mix(out.text, out.bg, 0.4);
  // Contraste mínimo (WCAG AA) entre texto e fundo; senão, os do kit.
  if (contrast(out.text, out.bg) < 4.5) out.text = DEFAULT_PALETTE.text;
  if (contrast(out.text, out.surface) < 4.5) out.surface = '#ffffff';
  if (contrast(out.muted, out.bg) < 3) out.muted = mix(out.text, out.bg, 0.3);
  if (luminance(out.dark) > 0.1) out.dark = mix(out.dark, '#000000', 0.7);
  return out;
}

const px = v => { const m = /^([\d.]+)(px|rem|em)$/.exec(String(v || '')); return m ? parseFloat(m[1]) * (m[2] === 'px' ? 1 : 16) : null; };
function weighted(map) {
  const e = Object.entries(map || {}).sort((a, b) => b[1] - a[1]);
  return e.length ? e[0][0] : null;
}

/** Fontes curadas mais próximas das usadas no site (títulos e texto). */
function deriveFonts(tokens) {
  const f = tokens.fonts || {};
  const declared = (f.declared || []).filter(Boolean);
  const heading = weighted(f.heading) || weighted(f.body) || declared[0] || null;
  const body = weighted(f.body) || declared.find(d => d !== heading) || heading;
  return {
    original: { heading: heading || null, body: body || null },
    heading: heading ? closestFont(heading, HEADING_FONTS) : HEADING_FONTS[0],
    body: body ? closestFont(body, BODY_FONTS) : BODY_FONTS[0],
  };
}

/** elegant | modern | bold | soft pelo conjunto: fonte dos títulos, cantos, peso e saturação. */
function deriveStyle(tokens, fonts, palette) {
  const radii = Object.entries(tokens.radii || {}).map(([v, n]) => [px(v), n]).filter(([v]) => v !== null && v < 200);
  const total = radii.reduce((s, [, n]) => s + n, 0);
  const avgRadius = total ? radii.reduce((s, [v, n]) => s + v * n, 0) / total : 8;
  const weights = Object.entries(tokens.font_weights || {}).map(([w, n]) => [Number(w), n]);
  const heavy = weights.filter(([w]) => w >= 800).reduce((s, [, n]) => s + n, 0) >= Math.max(2, weights.reduce((s, [, n]) => s + n, 0) * 0.2);
  const cat = fontCategory(fonts.original.heading || fonts.heading);
  const sat = hsl(palette.primary).s;
  if (cat === 'display' || (heavy && sat > 0.6)) return 'bold';
  if (cat === 'serif' || cat === 'script') return 'elegant';
  if (cat === 'rounded' || avgRadius >= 16) return 'soft';
  return 'modern';
}

/** Ordem das seções para o kit: hero primeiro, contact por último, pelo menos 6. */
function deriveSections(layout) {
  const seen = (layout || []).filter(t => SECTION_TYPES.includes(t));
  const order = ['hero', ...seen.filter(t => t !== 'hero' && t !== 'contact')];
  for (const t of ['services', 'about', 'gallery', 'testimonials', 'faq', 'cta']) if (order.length < 6 && !order.includes(t)) order.push(t);
  return [...new Set(order), 'contact'].map(type => ({ type }));
}

/**
 * Base visual (spec parcial) a partir dos tokens.
 * @param {object} tokens  saída de parseCss/parseHtml (ou da captura no navegador)
 * @param {{ url?: string, host?: string }} [source]
 */
function designBase(tokens, source = {}) {
  const palette = derivePalette(tokens);
  const fonts = deriveFonts(tokens);
  const style = deriveStyle(tokens, fonts, palette);
  return {
    source: { host: source.host || null },
    style, fonts: { heading: fonts.heading, body: fonts.body }, fonts_original: fonts.original, palette,
    sections: deriveSections(tokens.layout),
  };
}

/** Texto para o Designer: usar a base visual, nunca o conteúdo do site de referência. */
function designPrompt(base) {
  return `\n\nBase visual obrigatória (tirada do site de referência ${base.source.host || ''}; só o design):
- use exatamente style "${base.style}", fonts ${JSON.stringify(base.fonts)} e palette ${JSON.stringify(base.palette)};
- siga esta ordem de seções (type): ${base.sections.map(s => s.type).join(', ')};
- NÃO copie textos, nomes, marcas, logos, fotos ou slogans do site de referência: todo o conteúdo é do negócio do pedido; o que o pedido não informar, escreva como exemplo para o cliente trocar.`;
}

/** Aplica a base no spec já validado (cores, fontes, estilo e ordem das seções do site de referência). */
function applyDesignBase(spec, base) {
  if (!spec || !base) return spec;
  const out = { ...spec, palette: { ...spec.palette, ...base.palette }, fonts: { ...base.fonts }, style: base.style };
  if (Array.isArray(spec.sections) && Array.isArray(base.sections)) {
    const rank = t => { const i = base.sections.findIndex(s => s.type === t); return t === 'hero' ? -1 : t === 'contact' ? 99 : i < 0 ? 50 : i; };
    out.sections = spec.sections.map((s, i) => [s, i]).sort((a, b) => (rank(a[0].type) - rank(b[0].type)) || (a[1] - b[1])).map(([s]) => s);
  }
  return out;
}

module.exports = { HEADING_FONTS, BODY_FONTS, fontCategory, closestFont, luminance, contrast, derivePalette, deriveFonts, deriveStyle, deriveSections,
  designBase, designPrompt, applyDesignBase, DEFAULT_PALETTE };
