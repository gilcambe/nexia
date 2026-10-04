'use strict';
// ADR-FREE-01: tipos do Firestore (Timestamp, FieldValue, FieldPath) e conversão para o
// formato JSON da API REST v1. Mesma interface que o firebase-admin usa no código do NEXIA.

class Timestamp {
  constructor(seconds, nanoseconds = 0) {
    // Mesmos nomes internos do firebase-admin: JSON.stringify(ts) continua igual.
    this._seconds = Math.floor(seconds);
    this._nanoseconds = Math.floor(nanoseconds);
  }
  get seconds() { return this._seconds; }
  get nanoseconds() { return this._nanoseconds; }
  static now() { return Timestamp.fromMillis(Date.now()); }
  static fromDate(d) { return Timestamp.fromMillis(d.getTime()); }
  static fromMillis(ms) {
    const seconds = Math.floor(ms / 1000);
    return new Timestamp(seconds, Math.round((ms - seconds * 1000) * 1e6));
  }
  /** "2026-10-04T01:02:03.123456789Z" → Timestamp (preserva os nanossegundos). */
  static fromISO(s) {
    const m = /^(.*?)(?:\.(\d{1,9}))?(Z|[+-]\d\d:\d\d)$/.exec(s);
    if (!m) return Timestamp.fromMillis(Date.parse(s));
    const seconds = Math.floor(Date.parse(m[1] + m[3]) / 1000);
    const nanos = m[2] ? Number(m[2].padEnd(9, '0')) : 0;
    return new Timestamp(seconds, nanos);
  }
  toDate() { return new Date(this.toMillis()); }
  toMillis() { return this._seconds * 1000 + Math.floor(this._nanoseconds / 1e6); }
  toISO() {
    const base = new Date(this._seconds * 1000).toISOString().slice(0, 19);
    return `${base}.${String(this._nanoseconds).padStart(9, '0')}Z`;
  }
  isEqual(o) { return o instanceof Timestamp && o._seconds === this._seconds && o._nanoseconds === this._nanoseconds; }
  valueOf() { return `${String(this._seconds + 1e11).padStart(12, '0')}.${String(this._nanoseconds).padStart(9, '0')}`; }
  toString() { return `Timestamp(seconds=${this._seconds}, nanoseconds=${this._nanoseconds})`; }
}

class FieldValue {
  constructor(kind, arg) { this._kind = kind; this._arg = arg; }
  static serverTimestamp() { return new FieldValue('serverTimestamp'); }
  static increment(n) { return new FieldValue('increment', n); }
  static arrayUnion(...v) { return new FieldValue('arrayUnion', v); }
  static arrayRemove(...v) { return new FieldValue('arrayRemove', v); }
  static delete() { return new FieldValue('delete'); }
  isEqual(o) { return o instanceof FieldValue && o._kind === this._kind && JSON.stringify(o._arg) === JSON.stringify(this._arg); }
}

class FieldPath {
  constructor(...segments) {
    if (!segments.length || segments.some(s => typeof s !== 'string' || !s)) throw new Error('FieldPath inválido.');
    this.segments = segments;
  }
  static documentId() { return DOCUMENT_ID; }
  /** Forma canônica da API: segmentos simples ou entre crases. */
  canonical() {
    return this.segments.map(s => (/^[A-Za-z_][A-Za-z_0-9]*$/.test(s) ? s : '`' + s.replace(/\\/g, '\\\\').replace(/`/g, '\\`') + '`')).join('.');
  }
  isEqual(o) { return o instanceof FieldPath && o.canonical() === this.canonical(); }
}
const DOCUMENT_ID = new FieldPath('__name__');

/** 'a.b' ou FieldPath → FieldPath (strings com ponto são caminhos, como no firebase-admin). */
function toFieldPath(p) {
  if (p instanceof FieldPath) return p;
  if (typeof p !== 'string' || !p) throw new Error('Caminho de campo inválido.');
  return new FieldPath(...p.split('.'));
}

class GeoPoint {
  constructor(latitude, longitude) { this.latitude = latitude; this.longitude = longitude; }
}

const isPlainObject = v => v !== null && typeof v === 'object' && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);

/**
 * Valor JS → Value da API REST. Sentinelas (FieldValue) nunca chegam aqui: são
 * separadas antes em transforms. undefined é ignorado (ignoreUndefinedProperties).
 */
function encodeValue(v, refName) {
  if (v === null) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') {
    return Number.isSafeInteger(v) && !Object.is(v, -0) ? { integerValue: String(v) } : { doubleValue: Number.isFinite(v) ? v : String(v) };
  }
  if (typeof v === 'bigint') return { integerValue: String(v) };
  if (typeof v === 'string') return { stringValue: v };
  if (v instanceof Timestamp) return { timestampValue: v.toISO() };
  if (v instanceof Date) return { timestampValue: Timestamp.fromDate(v).toISO() };
  if (v instanceof GeoPoint) return { geoPointValue: { latitude: v.latitude, longitude: v.longitude } };
  if (v instanceof Uint8Array) return { bytesValue: Buffer.from(v).toString('base64') };
  if (v && typeof v === 'object' && v.__isDocumentReference) return { referenceValue: refName(v) };
  if (v instanceof FieldValue) throw new Error(`FieldValue.${v._kind}() não pode ser usado aqui (dentro de array ou filtro).`);
  if (Array.isArray(v)) return { arrayValue: { values: v.filter(x => x !== undefined).map(x => encodeValue(x, refName)) } };
  if (typeof v === 'object') return { mapValue: { fields: encodeFields(v, refName) } };
  throw new Error(`Tipo não suportado no Firestore: ${typeof v}`);
}

function encodeFields(obj, refName) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = encodeValue(v, refName);
  return out;
}

/** Value da API REST → valor JS (mesmos tipos que o firebase-admin devolve). */
function decodeValue(v, makeRef) {
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('timestampValue' in v) return Timestamp.fromISO(v.timestampValue);
  if ('stringValue' in v) return v.stringValue;
  if ('bytesValue' in v) return Buffer.from(v.bytesValue, 'base64');
  if ('referenceValue' in v) return makeRef(v.referenceValue);
  if ('geoPointValue' in v) return new GeoPoint(v.geoPointValue.latitude || 0, v.geoPointValue.longitude || 0);
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(x => decodeValue(x, makeRef));
  if ('mapValue' in v) return decodeFields(v.mapValue.fields || {}, makeRef);
  return null;
}

function decodeFields(fields, makeRef) {
  const out = {};
  for (const [k, v] of Object.entries(fields || {})) out[k] = decodeValue(v, makeRef);
  return out;
}

module.exports = {
  Timestamp, FieldValue, FieldPath, GeoPoint, DOCUMENT_ID,
  toFieldPath, isPlainObject, encodeValue, encodeFields, decodeValue, decodeFields,
};
