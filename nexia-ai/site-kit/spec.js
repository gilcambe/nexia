'use strict';
// Spec de site/sistema que o Designer devolve (ADR-Q-04). O modelo grátis só escreve conteúdo e escolhas
// visuais em JSON; o kit monta HTML/CSS/JS de nível profissional. Aqui o JSON é lido com tolerância
// (texto em volta, vírgula sobrando), validado e completado com padrões.

const FONT = /^[A-Za-z0-9 ]{2,40}$/;
const HEX = /^#[0-9a-f]{6}$/i;
const STYLES = ['elegant', 'modern', 'bold', 'soft'];
const SECTION_TYPES = ['hero', 'services', 'about', 'gallery', 'team', 'testimonials', 'faq', 'cta', 'contact'];
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

function palette(p = {}) {
  const d = { primary: '#1f6f5c', accent: '#f2a541', bg: '#fbfaf7', surface: '#ffffff', text: '#1d2426', muted: '#5d6b6e', dark: '#12201d' };
  const out = {};
  for (const k of Object.keys(d)) out[k] = HEX.test(p[k] || '') ? p[k] : d[k];
  return out;
}

const cta = c => (c && str(c.label, 40) ? { label: str(c.label, 40), href: str(c.href, 200) || '#contato' } : null);

function section(s) {
  const type = SECTION_TYPES.includes(s && s.type) ? s.type : null;
  if (!type) return null;
  const base = { type, id: slugify(s.id || s.title || type) || type, title: str(s.title, 120), subtitle: str(s.subtitle || s.text, 600) };
  switch (type) {
    case 'hero': return { ...base, eyebrow: str(s.eyebrow, 60), cta: cta(s.cta), cta2: cta(s.cta2), image_query: str(s.image_query, 100), video_query: str(s.video_query, 100) };
    case 'services': return { ...base, items: arr(s.items, 12).map(i => ({ title: str(i.title, 80), text: str(i.text, 300), price: str(i.price, 40), image_query: str(i.image_query, 100) })).filter(i => i.title) };
    case 'about': return { ...base, text: str(s.text, 1200), image_query: str(s.image_query, 100), stats: arr(s.stats, 4).map(x => ({ value: str(x.value, 12), label: str(x.label, 40) })).filter(x => x.value) };
    case 'gallery': return { ...base, image_queries: arr(s.image_queries, 8).map(q => str(q, 100)).filter(Boolean) };
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
  const okFont = f => typeof f === 'string' && FONT.test(f);
  const fonts = { heading: okFont(rf.heading) ? rf.heading.trim() : (kind === 'system' ? 'Plus Jakarta Sans' : 'Fraunces'),
    body: okFont(rf.body) ? rf.body.trim() : 'Inter' };
  const contact = r.contact && typeof r.contact === 'object' ? r.contact : {};
  const spec = {
    kind, name, tagline: str(r.tagline, 160), description: str(r.description, 300) || str(r.tagline, 160),
    folder: safeFolder([((request.match(/\b(?:pasta|diret[oó]rio|folder)\s+(?:nova\s+)?([A-Za-z0-9_-][A-Za-z0-9._-]*\/[A-Za-z0-9._/-]*)/i) || [])[1] || '').replace(/[./]+$/, ''), r.folder], name),
    fonts, palette: palette(r.palette), style: STYLES.includes(r.style) ? r.style : 'modern',
    contact: { whatsapp: str(contact.whatsapp, 20).replace(/\D/g, ''), phone: str(contact.phone, 30), email: str(contact.email, 80), address: str(contact.address, 160),
      city: str(contact.city, 60), hours: str(contact.hours, 120), instagram: str(contact.instagram, 60).replace(/^@/, ''), facebook: str(contact.facebook, 60) },
  };
  if (kind === 'site') {
    spec.sections = arr(r.sections, 12).map(section).filter(Boolean);
    if (!spec.sections.some(s => s.type === 'hero')) errors.push('falta a seção "hero"');
    if (spec.sections.length < 4) errors.push('o site precisa de pelo menos 4 seções');
    if (!spec.sections.some(s => s.type === 'contact')) spec.sections.push(section({ type: 'contact', title: 'Fale com a gente' }));
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
    if (s.type === 'gallery') s.image_queries.forEach((q, k) => push({ slot: `s${si}.g${k}`, query: q }));
    if (s.type === 'team') s.members.forEach((m, k) => m.image_query && push({ slot: `s${si}.m${k}`, query: m.image_query, orientation: 'portrait' }));
  }
  return out;
}

module.exports = { normalizeSpec, extractJson, mediaQueries, slugify, SECTION_TYPES, FIELD_TYPES };
