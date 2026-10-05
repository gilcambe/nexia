'use strict';
// Spec de site/sistema que o Designer devolve (ADR-Q-04). O modelo grátis só escreve conteúdo e escolhas
// visuais em JSON; o kit monta HTML/CSS/JS de nível profissional. Aqui o JSON é lido com tolerância
// (texto em volta, vírgula sobrando), validado e completado com padrões.

const HEX = /^#[0-9a-f]{6}$/i;
const STYLES = ['elegant', 'modern', 'bold', 'soft'];
const SECTION_TYPES = ['hero', 'services', 'about', 'gallery', 'video', 'music', 'links', 'team', 'testimonials', 'faq', 'cta', 'contact'];
// Fontes boas do Google Fonts (ADR-Q-05): a IA escolhe; fora da lista, o kit troca por um par que combina com o estilo.
const HEADING_FONTS = ['Fraunces', 'Playfair Display', 'DM Serif Display', 'Cormorant Garamond', 'Libre Baskerville', 'Lora', 'Sora', 'Outfit',
  'Plus Jakarta Sans', 'Manrope', 'Space Grotesk', 'Syne', 'Bricolage Grotesque', 'Archivo', 'Poppins', 'Montserrat', 'Raleway', 'Lexend', 'Urbanist', 'Bebas Neue', 'Oswald', 'Unbounded'];
const BODY_FONTS = ['Inter', 'DM Sans', 'Manrope', 'Nunito Sans', 'Source Sans 3', 'Work Sans', 'Karla', 'Rubik', 'Figtree', 'Plus Jakarta Sans', 'Open Sans', 'Lato', 'Mulish', 'Outfit'];
const FONT_PAIRS = { elegant: ['Cormorant Garamond', 'Nunito Sans'], modern: ['Sora', 'Inter'], bold: ['Bricolage Grotesque', 'DM Sans'], soft: ['Fraunces', 'Inter'] };
const pickFont = (f, list) => { const k = typeof f === 'string' ? list.find(x => x.toLowerCase() === f.trim().toLowerCase()) : null; return k || null; };
const FIELD_TYPES = ['text', 'number', 'money', 'date', 'email', 'phone', 'select', 'textarea'];

const str = (v, max = 300) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : typeof v === 'number' ? String(v) : '');
const arr = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);
const slugify = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

/** Primeiro objeto JSON do texto (aceita ```json, texto antes/depois e vírgula antes de } ou ]). */
function extractJson(text) {
  const s = String(text || '');
  const start = s.indexOf('{');
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      const raw = s.slice(start, i + 1).replace(/,\s*([}\]])/g, '$1');
      try { return JSON.parse(raw); } catch { return null; }
    }
  }
  return null;
}

/** Primeira pasta válida (a pedida pelo usuário vence a escolhida pela IA); sem nenhuma, sites/<nome>. */
function safeFolder(options, name) {
  for (const f of options) {
    const clean = String(f || '').trim().replace(/^\/+|\/+$/g, '');
    if (clean && /^[A-Za-z0-9._/-]{1,80}$/.test(clean) && !clean.split('/').some(p => p === '..' || p.startsWith('.'))) return clean;
  }
  return `sites/${slugify(name) || 'novo-site'}`;
}

// Contraste WCAG: a paleta é corrigida aqui (não reprova): texto legível no fundo, botão legível com texto branco.
const lum = hex => { const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const mix = (hex, to, k) => `#${[1, 3, 5].map(i => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - k) + parseInt(to.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join('')}`;
const darkenUntil = (c, bg, min) => { let out = c; for (let k = 0.1; contrast(out, bg) < min && k <= 1; k += 0.1) out = mix(c, '#000000', k); return out; };

function palette(p = {}) {
  const d = { primary: '#1f6f5c', accent: '#f2a541', bg: '#fbfaf7', surface: '#ffffff', text: '#1d2426', muted: '#5d6b6e', dark: '#12201d' };
  const out = {};
  for (const k of Object.keys(d)) out[k] = HEX.test(p[k] || '') ? p[k].toLowerCase() : d[k];
  if (lum(out.bg) < 0.6) out.bg = d.bg;                       // fundo do corpo sempre claro (o escuro é "dark")
  if (lum(out.surface) < 0.6) out.surface = '#ffffff';
  out.text = darkenUntil(out.text, out.bg, 7);
  out.muted = darkenUntil(out.muted, out.bg, 4.5);
  out.primary = darkenUntil(out.primary, '#ffffff', 4.5);    // botão com texto branco
  if (contrast(out.dark, '#ffffff') < 7) out.dark = darkenUntil(out.dark, '#ffffff', 7);
  return out;
}

const url = (u, max = 300) => { const v = str(u, max); return /^(https?:\/\/|mailto:|tel:)/i.test(v) && !/[\s"'<>]/.test(v) ? v : ''; };
const youtubeId = u => { const m = /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/.exec(String(u || '')); return m ? m[1] : ''; };
const LINK_ICONS = ['whatsapp', 'instagram', 'facebook', 'youtube', 'tiktok', 'linkedin', 'spotify', 'mail', 'phone', 'pin', 'link', 'calendar', 'cart', 'play'];

const cta = c => (c && str(c.label, 40) ? { label: str(c.label, 40), href: str(c.href, 200) || '#contato' } : null);

function section(s) {
  const type = SECTION_TYPES.includes(s && s.type) ? s.type : null;
  if (!type) return null;
  const base = { type, id: slugify(s.id || s.title || type) || type, title: str(s.title, 120), subtitle: str(s.subtitle || s.text, 600) };
  switch (type) {
    case 'hero': return { ...base, eyebrow: str(s.eyebrow, 60), cta: cta(s.cta), cta2: cta(s.cta2), image_query: str(s.image_query, 100), video_query: str(s.video_query, 100) };
    case 'services': return { ...base, items: arr(s.items, 12).map(i => ({ title: str(i.title, 80), text: str(i.text, 300), price: str(i.price, 40), image_query: str(i.image_query, 100) })).filter(i => i.title) };
    case 'about': return { ...base, text: str(s.text, 1200), image_query: str(s.image_query, 100), stats: arr(s.stats, 4).map(x => ({ value: str(x.value, 12), label: str(x.label, 40) })).filter(x => x.value) };
    case 'gallery': return { ...base, image_queries: arr(s.image_queries, 8).map(q => str(q, 100)).filter(Boolean), gif_queries: arr(s.gif_queries, 2).map(q => str(q, 100)).filter(Boolean) };
    case 'video': { const yt = youtubeId(s.youtube || s.url); const q = str(s.video_query, 100); return yt || q ? { ...base, youtube: yt, video_query: yt ? '' : q } : null; }
    case 'music': { const au = url(s.audio_url); const q = str(s.audio_query, 100); return au || q ? { ...base, audio_url: au, audio_title: str(s.audio_title, 80), audio_query: au ? '' : q } : null; }
    case 'links': { const items = arr(s.items, 12).map(i => ({ label: str(i.label, 60), url: url(i.url), icon: LINK_ICONS.includes(i.icon) ? i.icon : 'link' })).filter(i => i.label && i.url); return items.length ? { ...base, items } : null; }
    case 'team': return { ...base, members: arr(s.members, 8).map(m => ({ name: str(m.name, 60), role: str(m.role, 80), image_query: str(m.image_query, 100) })).filter(m => m.name) };
    case 'testimonials': return { ...base, items: arr(s.items, 6).map(i => ({ name: str(i.name, 60), role: str(i.role, 60), text: str(i.text, 400), rating: Math.min(Math.max(Number(i.rating) || 5, 1), 5) })).filter(i => i.text) };
    case 'faq': return { ...base, items: arr(s.items, 10).map(i => ({ q: str(i.q || i.question, 200), a: str(i.a || i.answer, 800) })).filter(i => i.q && i.a) };
    case 'cta': return { ...base, cta: cta(s.cta) };
    case 'contact': return { ...base, map: s.map !== false };
    default: return null;
  }
}

function entity(e) {
  const fields = arr(e && e.fields, 12).map(f => ({
    key: slugify(f.key || f.label).replace(/-/g, '_') || null, label: str(f.label || f.key, 40),
    type: FIELD_TYPES.includes(f.type) ? f.type : 'text', options: arr(f.options, 12).map(o => str(o, 40)).filter(Boolean), required: f.required !== false,
  })).filter(f => f.key && f.label);
  if (!fields.length) return null;
  const sample = arr(e.sample, 20).filter(r => r && typeof r === 'object').map(r => Object.fromEntries(fields.map(f => [f.key, str(r[f.key], 200)])));
  return { key: slugify(e.key || e.label).replace(/-/g, '_') || 'itens', label: str(e.label || e.key, 40), singular: str(e.singular, 40) || str(e.label, 40), fields, sample };
}

/**
 * @returns {{ spec?: object, errors: string[] }}
 */
function normalizeSpec(raw, { kind: forcedKind, request = '' } = {}) {
  const errors = [];
  const r = raw && typeof raw === 'object' ? raw : {};
  const kind = forcedKind || (r.kind === 'system' ? 'system' : 'site');
  const name = str(r.name, 60);
  if (!name) errors.push('falta "name" (nome do negócio ou do sistema)');
  const rf = r.fonts && typeof r.fonts === 'object' ? r.fonts : {};
  const style = STYLES.includes(r.style) ? r.style : 'modern';
  const pair = kind === 'system' ? ['Plus Jakarta Sans', 'Inter'] : FONT_PAIRS[style];
  const fonts = { heading: pickFont(rf.heading, HEADING_FONTS) || pair[0], body: pickFont(rf.body, BODY_FONTS) || pair[1] };
  if (fonts.body === fonts.heading) fonts.body = fonts.heading === 'Inter' ? 'DM Sans' : 'Inter';
  const contact = r.contact && typeof r.contact === 'object' ? r.contact : {};
  const spec = {
    kind, name, tagline: str(r.tagline, 160), photo_theme: str(r.photo_theme, 40), description: str(r.description, 300) || str(r.tagline, 160),
    folder: safeFolder([((request.match(/\b(?:pasta|diret[oó]rio|folder)\s+(?:nova\s+)?([A-Za-z0-9_-][A-Za-z0-9._-]*\/[A-Za-z0-9._/-]*)/i) || [])[1] || '').replace(/[./]+$/, ''), r.folder], name),
    fonts, palette: palette(r.palette), style,
    contact: { whatsapp: str(contact.whatsapp, 20).replace(/\D/g, ''), phone: str(contact.phone, 30), email: str(contact.email, 80), address: str(contact.address, 160),
      city: str(contact.city, 60), hours: str(contact.hours, 120), instagram: str(contact.instagram, 60).replace(/^@/, ''), facebook: str(contact.facebook, 60),
      youtube: url(contact.youtube), tiktok: str(contact.tiktok, 60).replace(/^@/, ''), linkedin: url(contact.linkedin) },
  };
  if (kind === 'site') {
    spec.sections = arr(r.sections, 12).map(section).filter(Boolean);
    if (!spec.sections.some(s => s.type === 'hero')) errors.push('falta a seção "hero"');
    if (spec.sections.length < 4) errors.push('o site precisa de pelo menos 4 seções');
    if (!spec.sections.some(s => s.type === 'contact')) spec.sections.push(section({ type: 'contact', title: 'Fale com a gente' }));
    // Âncoras únicas e sem colidir com as fixas da página.
    const taken = new Set(['topo', 'conteudo', 'menu', 'contato']);
    for (const s of spec.sections) {
      if (s.type === 'contact') continue;
      let id = s.id, n = 2;
      while (taken.has(id)) id = `${s.id}-${n++}`;
      taken.add(id);
      s.id = id;
    }
  } else {
    spec.entities = arr(r.entities, 6).map(entity).filter(Boolean);
    if (!spec.entities.length) errors.push('o sistema precisa de pelo menos 1 entidade em "entities" com "fields"');
    spec.modules = arr(r.modules, 8).map(m => str(m, 40)).filter(Boolean);
  }
  return { spec: errors.length ? undefined : spec, errors };
}

/** Lista de buscas de mídia do spec: [{ slot, query, orientation }] (o orquestrador resolve com media.search_*). */
function mediaQueries(spec) {
  const out = [];
  const fallback = `${spec.name} ${spec.tagline}`.trim();
  const push = o => { const q = String(o.query || '').replace(/\s+/g, ' ').trim(); out.push({ ...o, query: (/[a-z]{2}/i.test(q) ? q : fallback || 'business').slice(0, 100) }); };
  if (spec.kind !== 'site') return out;
  for (const [si, s] of spec.sections.entries()) {
    if (s.type === 'hero') {
      push({ slot: `s${si}.hero`, query: s.image_query || `${spec.name} ${spec.tagline}`.slice(0, 80), orientation: 'landscape' });
      if (s.video_query) push({ slot: `s${si}.video`, query: s.video_query, kind: 'video', orientation: 'landscape' });
    }
    if (s.type === 'about') push({ slot: `s${si}.about`, query: s.image_query || s.title, orientation: 'landscape' });
    if (s.type === 'services') s.items.forEach((it, k) => push({ slot: `s${si}.item${k}`, query: it.image_query || it.title, orientation: 'landscape' }));
    if (s.type === 'gallery') {
      s.image_queries.forEach((q, k) => push({ slot: `s${si}.g${k}`, query: q }));
      s.gif_queries.forEach((q, k) => push({ slot: `s${si}.gif${k}`, query: q, kind: 'gif' }));
    }
    if (s.type === 'video' && s.video_query) push({ slot: `s${si}.clip`, query: s.video_query, kind: 'video', orientation: 'landscape' });
    if (s.type === 'music' && s.audio_query) push({ slot: `s${si}.audio`, query: s.audio_query, kind: 'audio' });
    if (s.type === 'team') s.members.forEach((m, k) => m.image_query && push({ slot: `s${si}.m${k}`, query: m.image_query, orientation: 'portrait' }));
  }
  return out;
}

module.exports = { normalizeSpec, extractJson, mediaQueries, slugify, contrast, youtubeId, SECTION_TYPES, FIELD_TYPES, HEADING_FONTS, BODY_FONTS };
