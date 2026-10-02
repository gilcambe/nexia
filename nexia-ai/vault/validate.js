'use strict';
// Validação de schema do Vault: campos desconhecidos rejeitados, tipos, enums,
// limites, relações e varredura de secrets em todo texto. Sem dependências externas.
const { detectSecret } = require('./secrets');

// ── Tipos de campo ───────────────────────────────────────────────────────────
const t = {
  string: (o = {}) => ({ kind: 'string', min: 1, max: 200, ...o }),
  text: (o = {}) => ({ kind: 'string', min: 1, max: 8000, ...o }),
  slug: (o = {}) => ({ kind: 'string', min: 2, max: 63, pattern: /^[a-z0-9][a-z0-9-]*[a-z0-9]$/, patternName: 'slug', ...o }),
  enum: (values, o = {}) => ({ kind: 'enum', values, ...o }),
  int: (o = {}) => ({ kind: 'int', min: 0, max: Number.MAX_SAFE_INTEGER, ...o }),
  bool: (o = {}) => ({ kind: 'bool', ...o }),
  timestamp: (o = {}) => ({ kind: 'timestamp', ...o }),
  url: (o = {}) => ({ kind: 'url', max: 2048, ...o }),
  sha: (lengths, o = {}) => ({ kind: 'sha', lengths, ...o }),
  ref: (entity, o = {}) => ({ kind: 'ref', entity, ...o }),
  array: (of, o = {}) => ({ kind: 'array', of, min: 0, max: 100, ...o }),
  object: (shape, o = {}) => ({ kind: 'object', shape, ...o }),
};

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

/**
 * Valida um valor contra a definição de campo.
 * @returns valor normalizado; registra problemas em `issues` ({ path, rule }) e
 * suspeitas de secret em `secrets` ({ path, detectors }). Nunca registra o valor.
 */
function checkField(def, value, path, ctx) {
  const issue = rule => { ctx.issues.push({ path, rule }); return undefined; };
  const scan = s => { const d = detectSecret(s); if (d.length) ctx.secrets.push({ path, detectors: d }); };

  switch (def.kind) {
    case 'string': {
      if (typeof value !== 'string') return issue('type:string');
      const v = value.trim();
      if (v.length < def.min) return issue('minLength');
      if (v.length > def.max) return issue('maxLength');
      if (def.pattern && !def.pattern.test(v)) return issue('pattern:' + (def.patternName || 'custom'));
      if (!def.noScan) scan(v);
      return v;
    }
    case 'enum':
      if (!def.values.includes(value)) return issue('enum');
      return value;
    case 'int':
      if (!Number.isInteger(value)) return issue('type:int');
      if (value < def.min) return issue('min');
      if (value > def.max) return issue('max');
      return value;
    case 'bool':
      if (typeof value !== 'boolean') return issue('type:bool');
      return value;
    case 'timestamp': {
      let d;
      if (value instanceof Date) d = value;
      else if (value && typeof value.toDate === 'function') d = value.toDate(); // Firestore Timestamp
      else if (typeof value === 'string' && ISO_RE.test(value)) d = new Date(value);
      else return issue('type:timestamp');
      if (Number.isNaN(d.getTime())) return issue('type:timestamp');
      return d;
    }
    case 'url': {
      if (typeof value !== 'string' || value.length > def.max) return issue('type:url');
      let u;
      try { u = new URL(value); } catch { return issue('type:url'); }
      const okLocal = u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname);
      if (u.protocol !== 'https:' && !okLocal) return issue('url:https');
      if (u.username || u.password) { ctx.secrets.push({ path, detectors: ['url_with_credentials'] }); return undefined; }
      scan(value);
      return value;
    }
    case 'sha':
      if (typeof value !== 'string' || !def.lengths.includes(value.length) || !/^[0-9a-f]+$/.test(value)) return issue('type:sha');
      return value;
    case 'ref':
      if (typeof value !== 'string' || !ctx.refPattern(def.entity).test(value)) return issue('ref:' + def.entity);
      ctx.refs.push({ path, entity: def.entity, id: value });
      return value;
    case 'array': {
      if (!Array.isArray(value)) return issue('type:array');
      if (value.length < def.min) return issue('minItems');
      if (value.length > def.max) return issue('maxItems');
      const out = value.map((item, i) => checkField(def.of, item, `${path}[${i}]`, ctx));
      if (def.unique) {
        const keys = out.map(v => JSON.stringify(v));
        if (new Set(keys).size !== keys.length) return issue('uniqueItems');
      }
      return out;
    }
    case 'object': {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return issue('type:object');
      return checkShape(def.shape, value, path, ctx, { partial: false });
    }
    default:
      return issue('schema:kind');
  }
}

function checkShape(shape, input, basePath, ctx, { partial }) {
  const out = {};
  for (const key of Object.keys(input)) {
    if (!Object.prototype.hasOwnProperty.call(shape, key)) ctx.issues.push({ path: join(basePath, key), rule: 'unknownField' });
  }
  for (const [key, def] of Object.entries(shape)) {
    const path = join(basePath, key);
    const present = Object.prototype.hasOwnProperty.call(input, key) && input[key] !== undefined;
    if (!present) {
      if (partial) continue;
      if (def.required) ctx.issues.push({ path, rule: 'required' });
      else if (def.default !== undefined) out[key] = typeof def.default === 'function' ? def.default() : def.default;
      continue;
    }
    if (input[key] === null) {
      if (def.required) ctx.issues.push({ path, rule: 'required' });
      else out[key] = null;
      continue;
    }
    const v = checkField(def, input[key], path, ctx);
    if (v !== undefined) out[key] = v;
  }
  return out;
}

const join = (base, key) => (base ? `${base}.${key}` : key);

/**
 * Valida dados de domínio de uma entidade.
 * @param {object} schema  definição do schemas.js
 * @param {object} input
 * @param {{ partial?: boolean, refPattern: (entity) => RegExp }} opts
 */
function validateEntity(schema, input, { partial = false, refPattern }) {
  const ctx = { issues: [], secrets: [], refs: [], refPattern };
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { value: null, issues: [{ path: '', rule: 'type:object' }], secrets: [], refs: [] };
  }
  const value = checkShape(schema.fields, input, '', ctx, { partial });
  if (!partial) {
    for (const group of schema.atLeastOne || []) {
      if (!group.some(f => value[f] !== undefined && value[f] !== null)) ctx.issues.push({ path: group.join('|'), rule: 'atLeastOne' });
    }
    for (const [check, rule] of schema.checks || []) {
      if (!check(value)) ctx.issues.push({ path: '', rule });
    }
  }
  return { value, issues: ctx.issues, secrets: ctx.secrets, refs: ctx.refs };
}

/** JSON canônico (chaves ordenadas, datas em ISO) para hash de conteúdo e idempotência. */
function canonical(v) {
  if (v === null || v === undefined) return 'null';
  if (v instanceof Date) return JSON.stringify(v.toISOString());
  if (v && typeof v.toDate === 'function') return JSON.stringify(v.toDate().toISOString());
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
  return JSON.stringify(v);
}

module.exports = { t, validateEntity, canonical };
