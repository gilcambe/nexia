'use strict';
// ADR-FREE-01: cliente do Firestore pela API REST v1, com a mesma interface do firebase-admin
// que o NEXIA usa (collection/doc/get/set/update/create/delete/add, where/orderBy/limit/
// offset/select/startAfter, count, collectionGroup, batch, runTransaction, FieldValue,
// Timestamp, FieldPath). Roda no Node 20 e no Cloudflare Worker (só fetch + Web Crypto).
//
// Economia de subrequests (o Worker grátis permite 50 por pedido):
//  - leituras de documentos feitas no mesmo tick viram um único batchGet;
//  - a transação começa na primeira leitura (newTransaction), sem beginTransaction extra.

const {
  Timestamp, FieldValue, FieldPath, DOCUMENT_ID, toFieldPath, isPlainObject,
  encodeValue, decodeFields,
} = require('./values');

const GRPC = {
  OK: 0, CANCELLED: 1, UNKNOWN: 2, INVALID_ARGUMENT: 3, DEADLINE_EXCEEDED: 4, NOT_FOUND: 5, ALREADY_EXISTS: 6,
  PERMISSION_DENIED: 7, RESOURCE_EXHAUSTED: 8, FAILED_PRECONDITION: 9, ABORTED: 10, OUT_OF_RANGE: 11,
  UNIMPLEMENTED: 12, INTERNAL: 13, UNAVAILABLE: 14, DATA_LOSS: 15, UNAUTHENTICATED: 16,
};
const HTTP_TO_STATUS = { 400: 'INVALID_ARGUMENT', 401: 'UNAUTHENTICATED', 403: 'PERMISSION_DENIED', 404: 'NOT_FOUND',
  409: 'ABORTED', 412: 'FAILED_PRECONDITION', 429: 'RESOURCE_EXHAUSTED', 500: 'INTERNAL', 503: 'UNAVAILABLE', 504: 'DEADLINE_EXCEEDED' };

class FirestoreError extends Error {
  constructor(status, message, httpStatus) {
    super(`${GRPC[status] ?? 2} ${status}: ${message}`);
    this.name = 'FirestoreError';
    this.code = GRPC[status] ?? 2;
    this.status = status;
    this.details = message;
    this.httpStatus = httpStatus;
  }
}

const OPS = {
  '<': 'LESS_THAN', '<=': 'LESS_THAN_OR_EQUAL', '>': 'GREATER_THAN', '>=': 'GREATER_THAN_OR_EQUAL',
  '==': 'EQUAL', '!=': 'NOT_EQUAL', 'array-contains': 'ARRAY_CONTAINS', in: 'IN',
  'array-contains-any': 'ARRAY_CONTAINS_ANY', 'not-in': 'NOT_IN',
};

const AUTO_ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
function autoId() {
  const bytes = crypto.getRandomValues(new Uint8Array(40));
  let id = '';
  for (let i = 0; i < bytes.length && id.length < 20; i++) if (bytes[i] < 248) id += AUTO_ID_CHARS[bytes[i] % 62];
  return id;
}

const splitPath = p => String(p).split('/').filter(Boolean);

// ─── escrita: separa campos, máscara e transforms (FieldValue) ─────────────
// Árvore intermediária: { __nested: true, fields } para mapas e { __raw: valor } para folhas.
// Sentinelas (FieldValue) viram transforms no caminho completo; delete() entra só na máscara.
function walkTree(obj, prefix, { merge, mask, transforms }) {
  const tree = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    const path = [...prefix, k];
    if (v instanceof FieldValue) {
      if (v._kind === 'delete') {
        if (!mask) throw new Error('FieldValue.delete() só vale em update() ou set(..., { merge: true }).');
        mask.push(new FieldPath(...path));
      } else transforms.push([new FieldPath(...path), v]);
      continue;
    }
    if (isPlainObject(v) && (!merge || Object.keys(v).length)) {
      tree[k] = { __nested: true, fields: walkTree(v, path, { merge, mask, transforms }) };
      continue;
    }
    tree[k] = { __raw: v };
    if (merge) mask.push(new FieldPath(...path));
  }
  return tree;
}

function collectSet(data, merge) {
  const mask = merge ? [] : null;
  const transforms = [];
  const fields = walkTree(data, [], { merge, mask, transforms });
  return { fields, mask, transforms };
}

function setNested(target, segments, value) {
  let t = target;
  for (let i = 0; i < segments.length - 1; i++) {
    const s = segments[i];
    if (!t[s] || !t[s].__nested) t[s] = { __nested: true, fields: {} };
    t = t[s].fields;
  }
  t[segments[segments.length - 1]] = value;
}

function collectUpdate(data) {
  const fields = {};
  const mask = [];
  const transforms = [];
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    const fp = toFieldPath(k);
    if (v instanceof FieldValue) {
      if (v._kind === 'delete') mask.push(fp);
      else transforms.push([fp, v]);
      continue;
    }
    mask.push(fp);
    if (isPlainObject(v)) {
      setNested(fields, fp.segments, { __nested: true, fields: walkTree(v, fp.segments, { merge: false, mask: null, transforms }) });
    } else setNested(fields, fp.segments, { __raw: v });
  }
  return { fields, mask, transforms };
}

// ─── referências, consultas e snapshots ────────────────────────────────────
class DocumentSnapshot {
  constructor(ref, doc, readTime) {
    this.ref = ref;
    this.id = ref.id;
    this.exists = !!doc;
    this._fields = doc ? doc.fields || {} : null;
    this.createTime = doc && doc.createTime ? Timestamp.fromISO(doc.createTime) : undefined;
    this.updateTime = doc && doc.updateTime ? Timestamp.fromISO(doc.updateTime) : undefined;
    this.readTime = readTime ? Timestamp.fromISO(readTime) : undefined;
    this._data = undefined;
  }
  data() {
    if (!this.exists) return undefined;
    if (this._data === undefined) this._data = decodeFields(this._fields, name => this.ref.firestore._refFromName(name));
    return { ...this._data };
  }
  get(field) {
    if (!this.exists) return undefined;
    let v = this.data();
    for (const s of toFieldPath(field).segments) { if (v == null || typeof v !== 'object') return undefined; v = v[s]; }
    return v;
  }
  isEqual(o) { return o instanceof DocumentSnapshot && o.ref.path === this.ref.path && JSON.stringify(o._fields) === JSON.stringify(this._fields); }
}

class QuerySnapshot {
  constructor(query, docs, readTime) {
    this.query = query;
    this.docs = docs;
    this.size = docs.length;
    this.empty = docs.length === 0;
    this.readTime = readTime ? Timestamp.fromISO(readTime) : undefined;
  }
  forEach(cb, thisArg) { this.docs.forEach(cb, thisArg); }
}

class Query {
  constructor(firestore, parentPath, collectionId, allDescendants, q = {}) {
    this.firestore = firestore;
    this._parentPath = parentPath; // caminho do documento pai ('' = raiz)
    this._collectionId = collectionId;
    this._allDescendants = allDescendants;
    this._q = { where: [], orderBy: [], ...q };
  }
  _with(patch) { return new Query(this.firestore, this._parentPath, this._collectionId, this._allDescendants, { ...this._q, ...patch }); }

  where(field, op, value) {
    if (!OPS[op]) throw new Error(`Operador inválido: ${op}`);
    return this._with({ where: [...this._q.where, { field: toFieldPath(field), op, value }] });
  }
  orderBy(field, dir = 'asc') {
    return this._with({ orderBy: [...this._q.orderBy, { field: toFieldPath(field), dir: dir === 'desc' ? 'DESCENDING' : 'ASCENDING' }] });
  }
  limit(n) { return this._with({ limit: n }); }
  offset(n) { return this._with({ offset: n }); }
  select(...fields) { return this._with({ select: fields.map(toFieldPath) }); }
  startAfter(...v) { return this._with({ startAt: { values: v, before: false } }); }
  startAt(...v) { return this._with({ startAt: { values: v, before: true } }); }
  endAt(...v) { return this._with({ endAt: { values: v, before: false } }); }
  endBefore(...v) { return this._with({ endAt: { values: v, before: true } }); }
  count() { return new AggregateQuery(this); }

  _docName(id) {
    if (typeof id === 'object' && id && id.__isDocumentReference) return this.firestore._name(id.path);
    const s = String(id);
    if (s.includes('/')) return this.firestore._name(s);
    return this.firestore._name([this._parentPath, this._collectionId, s].filter(Boolean).join('/'));
  }

  _value(field, v) {
    if (field.isEqual(DOCUMENT_ID)) {
      if (Array.isArray(v)) return { arrayValue: { values: v.map(x => ({ referenceValue: this._docName(x) })) } };
      return { referenceValue: this._docName(v) };
    }
    return encodeValue(v, r => this.firestore._name(r.path));
  }

  _cursor(c) {
    let values = c.values;
    const orderBy = [...this._q.orderBy];
    if (values.length === 1 && values[0] instanceof DocumentSnapshot) {
      const snap = values[0];
      values = orderBy.map(o => (o.field.isEqual(DOCUMENT_ID) ? snap.ref : snap.get(o.field)));
      if (!orderBy.some(o => o.field.isEqual(DOCUMENT_ID))) values.push(snap.ref);
    }
    return { before: c.before, values: values.map((v, i) => {
      const field = (orderBy[i] && orderBy[i].field) || DOCUMENT_ID;
      if (v && v.__isDocumentReference) return { referenceValue: this.firestore._name(v.path) };
      return this._value(field, v);
    }) };
  }

  _structured() {
    const sq = { from: [{ collectionId: this._collectionId, ...(this._allDescendants ? { allDescendants: true } : {}) }] };
    const filters = this._q.where.map(({ field, op, value }) => {
      const fp = { fieldPath: field.canonical() };
      if (value === null && (op === '==' || op === '!=')) return { unaryFilter: { field: fp, op: op === '==' ? 'IS_NULL' : 'IS_NOT_NULL' } };
      if (typeof value === 'number' && Number.isNaN(value) && (op === '==' || op === '!=')) return { unaryFilter: { field: fp, op: op === '==' ? 'IS_NAN' : 'IS_NOT_NAN' } };
      return { fieldFilter: { field: fp, op: OPS[op], value: this._value(field, value) } };
    });
    if (filters.length === 1) sq.where = filters[0];
    else if (filters.length > 1) sq.where = { compositeFilter: { op: 'AND', filters } };
    let orderBy = this._q.orderBy;
    const cursorFromSnap = c => c && c.values.length === 1 && c.values[0] instanceof DocumentSnapshot;
    if ((cursorFromSnap(this._q.startAt) || cursorFromSnap(this._q.endAt)) && !orderBy.some(o => o.field.isEqual(DOCUMENT_ID))) {
      orderBy = [...orderBy, { field: DOCUMENT_ID, dir: orderBy.length ? orderBy[orderBy.length - 1].dir : 'ASCENDING' }];
    }
    if (orderBy.length) sq.orderBy = orderBy.map(o => ({ field: { fieldPath: o.field.canonical() }, direction: o.dir }));
    if (this._q.select) sq.select = { fields: (this._q.select.length ? this._q.select : [DOCUMENT_ID]).map(f => ({ fieldPath: f.canonical() })) };
    if (this._q.startAt) sq.startAt = this._cursor(this._q.startAt);
    if (this._q.endAt) sq.endAt = this._cursor(this._q.endAt);
    if (this._q.offset) sq.offset = this._q.offset;
    if (this._q.limit !== undefined) sq.limit = this._q.limit;
    return sq;
  }

  _parentName() { return this.firestore._name(this._parentPath); }

  async get() { return this.firestore._runQuery(this, null); }
}

class CollectionReference extends Query {
  constructor(firestore, path) {
    const segs = splitPath(path);
    if (segs.length % 2 !== 1) throw new Error(`Caminho de coleção inválido: ${path}`);
    super(firestore, segs.slice(0, -1).join('/'), segs[segs.length - 1], false);
    this.id = segs[segs.length - 1];
    this.path = segs.join('/');
  }
  get parent() { return this._parentPath ? new DocumentReference(this.firestore, this._parentPath) : null; }
  doc(id) {
    const docId = id === undefined ? autoId() : String(id);
    if (!docId) throw new Error('Id de documento vazio.');
    return new DocumentReference(this.firestore, `${this.path}/${docId}`);
  }
  async add(data) {
    const ref = this.doc();
    await ref.create(data);
    return ref;
  }
}

class DocumentReference {
  constructor(firestore, path) {
    const segs = splitPath(path);
    if (!segs.length || segs.length % 2 !== 0) throw new Error(`Caminho de documento inválido: ${path}`);
    this.firestore = firestore;
    this.path = segs.join('/');
    this.id = segs[segs.length - 1];
    this.__isDocumentReference = true;
  }
  get parent() { return new CollectionReference(this.firestore, splitPath(this.path).slice(0, -1).join('/')); }
  collection(sub) { return new CollectionReference(this.firestore, `${this.path}/${sub}`); }
  isEqual(o) { return o instanceof DocumentReference && o.path === this.path; }
  get() { return this.firestore._loader.load(this); }
  async set(data, opts) { return (await this.firestore._commit([this.firestore._writeSet(this, data, opts)]))[0]; }
  async update(data) { return (await this.firestore._commit([this.firestore._writeUpdate(this, data)]))[0]; }
  async create(data) { return (await this.firestore._commit([this.firestore._writeCreate(this, data)]))[0]; }
  async delete(precondition) { return (await this.firestore._commit([this.firestore._writeDelete(this, precondition)]))[0]; }
}
Object.defineProperty(DocumentReference.prototype, '__isDocumentReference', { value: true, enumerable: false, writable: true });

class AggregateQuery {
  constructor(query) { this.query = query; }
  async get() {
    const fs = this.query.firestore;
    const res = await fs._request(`${this.query._parentName()}:runAggregationQuery`, {
      structuredAggregationQuery: { structuredQuery: this.query._structured(), aggregations: [{ alias: 'count', count: {} }] },
    });
    const row = (Array.isArray(res) ? res : [res]).find(r => r.result) || { result: { aggregateFields: {} } };
    const count = Number((row.result.aggregateFields.count || {}).integerValue || 0);
    return { data: () => ({ count }), readTime: row.readTime ? Timestamp.fromISO(row.readTime) : undefined };
  }
}

// ─── leituras agrupadas (um batchGet por tick) ─────────────────────────────
class DocLoader {
  constructor(firestore, tx = null) { this.fs = firestore; this.tx = tx; this.pending = []; }
  load(ref) {
    return new Promise((resolve, reject) => {
      this.pending.push({ ref, resolve, reject });
      if (this.pending.length === 1) queueMicrotask(() => this.flush());
    });
  }
  async flush() {
    const batch = this.pending;
    this.pending = [];
    const names = [...new Set(batch.map(b => this.fs._name(b.ref.path)))];
    try {
      const rows = await (this.tx ? this.tx._read(opts => this.fs._batchGet(names, opts)) : this.fs._batchGet(names, null));
      const byName = new Map();
      for (const r of rows) {
        if (r.found) byName.set(r.found.name, { doc: r.found, readTime: r.readTime });
        else if (r.missing) byName.set(r.missing, { doc: null, readTime: r.readTime });
      }
      for (const b of batch) {
        const hit = byName.get(this.fs._name(b.ref.path)) || { doc: null };
        b.resolve(new DocumentSnapshot(b.ref, hit.doc, hit.readTime));
      }
    } catch (e) { for (const b of batch) b.reject(e); }
  }
}

class WriteBatch {
  constructor(firestore) { this.fs = firestore; this._writes = []; }
  set(ref, data, opts) { this._writes.push(this.fs._writeSet(ref, data, opts)); return this; }
  update(ref, data) { this._writes.push(this.fs._writeUpdate(ref, data)); return this; }
  create(ref, data) { this._writes.push(this.fs._writeCreate(ref, data)); return this; }
  delete(ref, precondition) { this._writes.push(this.fs._writeDelete(ref, precondition)); return this; }
  async commit() { return this._writes.length ? this.fs._commit(this._writes) : []; }
}

class Transaction {
  constructor(firestore) {
    this.fs = firestore;
    this._id = null;
    this._starting = null;
    this._writes = [];
    this._loader = new DocLoader(firestore, this);
  }
  /** Executa uma leitura dentro da transação; a primeira abre a transação (newTransaction). */
  async _read(fn) {
    if (this._id) return fn({ transaction: this._id });
    if (this._starting) { await this._starting.catch(() => {}); if (this._id) return fn({ transaction: this._id }); }
    const p = fn({ newTransaction: { readWrite: {} } });
    this._starting = p.then(rows => {
      const withTx = (Array.isArray(rows) ? rows : [rows]).find(r => r && r.transaction);
      if (withTx) this._id = withTx.transaction;
    });
    const rows = await p;
    await this._starting;
    return rows;
  }
  get(target) {
    if (target instanceof DocumentReference) return this._loader.load(target);
    if (target instanceof Query) return this.fs._runQuery(target, this);
    if (target instanceof AggregateQuery) return target.get();
    throw new Error('Transaction.get: alvo inválido.');
  }
  async getAll(...refs) { return Promise.all(refs.map(r => this.get(r))); }
  set(ref, data, opts) { this._writes.push(this.fs._writeSet(ref, data, opts)); return this; }
  update(ref, data) { this._writes.push(this.fs._writeUpdate(ref, data)); return this; }
  create(ref, data) { this._writes.push(this.fs._writeCreate(ref, data)); return this; }
  delete(ref, precondition) { this._writes.push(this.fs._writeDelete(ref, precondition)); return this; }
}

class Firestore {
  /**
   * @param {{ projectId: string, databaseId?: string, emulatorHost?: string, getToken?: () => Promise<string>, fetchImpl?: typeof fetch }} o
   */
  constructor({ projectId, databaseId = '(default)', emulatorHost, getToken, fetchImpl = (...a) => fetch(...a) }) {
    if (!projectId) throw new Error('Firestore: projectId ausente.');
    this.projectId = projectId;
    this._root = `projects/${projectId}/databases/${databaseId}/documents`;
    this._base = emulatorHost ? `http://${emulatorHost}/v1/` : 'https://firestore.googleapis.com/v1/';
    this._getToken = emulatorHost ? async () => 'owner' : getToken;
    this._fetch = fetchImpl;
    this._loader = new DocLoader(this);
    /** Documentos lidos e escritos (o que a cota grátis do Firestore conta); serve para medir o gasto de cada tarefa. */
    this.ops = { reads: 0, writes: 0 };
    /** Quantas chamadas HTTP este cliente já fez (medição do limite de subrequests). */
    this.requestCount = 0;
  }

  settings() {}
  collection(path) { return new CollectionReference(this, path); }
  doc(path) { return new DocumentReference(this, path); }
  collectionGroup(id) { return new Query(this, '', id, true); }
  batch() { return new WriteBatch(this); }
  async getAll(...refs) { return Promise.all(refs.map(r => r.get())); }

  _name(path) { return path ? `${this._root}/${path}` : this._root; }
  _refFromName(name) {
    const i = name.indexOf('/documents/');
    return new DocumentReference(this, i >= 0 ? name.slice(i + '/documents/'.length) : name);
  }

  /**
   * Rodízio de bancos: lista de projetos Firebase grátis ({projectId, getToken}). Quando o atual estoura a cota
   * (RESOURCE_EXHAUSTED) o cliente passa sozinho para o próximo e repete o pedido, sem esperar horário.
   * A cota grátis volta às 07:00 UTC, então um banco esgotado só é reusado depois disso.
   */
  enableFailover(bancos, agora = () => Date.now()) {
    this._bancos = bancos;
    this._esgotados = new Map();
    this._agora = agora;
  }
  _trocarBanco() {
    if (!this._bancos || this._bancos.length < 2) return false;
    const t = this._agora();
    const d = new Date(t);
    const volta = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + (d.getUTCHours() >= 7 ? 1 : 0), 7);
    this._esgotados.set(this.projectId, volta);
    const prox = this._bancos.find(b => b.projectId !== this.projectId && !((this._esgotados.get(b.projectId) || 0) > t));
    if (!prox) return false;
    this.projectId = prox.projectId;
    this._root = `projects/${prox.projectId}/databases/(default)/documents`;
    this._getToken = prox.getToken;
    this.bancoTrocas = (this.bancoTrocas || 0) + 1;
    console.warn(`[NEXIA] cota do banco acabou; trocando para ${prox.projectId}`);
    return true;
  }

  async _request(path, body) {
    try { return await this._requestUma(path, body); } catch (e) {
      if (!e || e.status !== 'RESOURCE_EXHAUSTED' || !this._bancos) throw e;
      const velho = this._root;
      const tx = body && body.transaction;
      if (!this._trocarBanco() || tx) throw e; // transação pertence ao banco antigo: quem chamou repete já no novo
      return this._request(path.split(velho).join(this._root), JSON.parse(JSON.stringify(body).split(velho).join(this._root)));
    }
  }

  async _requestUma(path, body) {
    this.requestCount++;
    const token = await this._getToken();
    const res = await this._fetch(this._base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = null; }
    if (!res.ok) {
      const err = Array.isArray(json) ? (json[0] && json[0].error) : json && json.error;
      const status = (err && err.status) || HTTP_TO_STATUS[res.status] || 'UNKNOWN';
      throw new FirestoreError(status, (err && err.message) || `Firestore respondeu ${res.status}.`, res.status);
    }
    return json;
  }

  async _batchGet(names, txOpts) {
    this.ops.reads += names.length;
    const rows = await this._request(`${this._root}:batchGet`, { documents: names, ...(txOpts || {}) });
    return Array.isArray(rows) ? rows : [rows];
  }

  async _runQuery(query, tx) {
    const run = opts => this._request(`${query._parentName()}:runQuery`, { structuredQuery: query._structured(), ...(opts || {}) })
      .then(r => (Array.isArray(r) ? r : [r]));
    const rows = tx ? await tx._read(run) : await run(null);
    this.ops.reads += Math.max(1, rows.filter(r => r && r.document).length);
    const docs = rows.filter(r => r && r.document).map(r => new DocumentSnapshot(this._refFromName(r.document.name), r.document, r.readTime));
    const readTime = (rows.find(r => r && r.readTime) || {}).readTime;
    return new QuerySnapshot(query, docs, readTime);
  }

  _encodeTree(tree) {
    const out = {};
    for (const [k, v] of Object.entries(tree)) {
      out[k] = v.__nested ? { mapValue: { fields: this._encodeTree(v.fields) } } : encodeValue(v.__raw, r => this._name(r.path));
    }
    return out;
  }

  _transforms(list) {
    return list.map(([fp, s]) => {
      const fieldPath = fp.canonical();
      const enc = x => encodeValue(x, r => this._name(r.path));
      switch (s._kind) {
        case 'serverTimestamp': return { fieldPath, setToServerValue: 'REQUEST_TIME' };
        case 'increment': return { fieldPath, increment: enc(s._arg) };
        case 'arrayUnion': return { fieldPath, appendMissingElements: { values: s._arg.map(enc) } };
        case 'arrayRemove': return { fieldPath, removeAllFromArray: { values: s._arg.map(enc) } };
        default: throw new Error(`FieldValue.${s._kind}() não suportado.`);
      }
    });
  }

  _writeSet(ref, data, opts = {}) {
    if (!isPlainObject(data)) throw new Error('set(): dados precisam ser um objeto.');
    const merge = !!(opts && (opts.merge || opts.mergeFields));
    const { fields, mask, transforms } = collectSet(data, merge);
    const w = { update: { name: this._name(ref.path), fields: this._encodeTree(fields) } };
    if (merge) w.updateMask = { fieldPaths: (opts.mergeFields ? opts.mergeFields.map(toFieldPath) : mask).map(f => f.canonical()) };
    if (transforms.length) w.updateTransforms = this._transforms(transforms);
    return w;
  }

  _writeUpdate(ref, data) {
    if (!isPlainObject(data) || !Object.keys(data).length) throw new Error('update(): dados precisam ser um objeto não vazio.');
    const { fields, mask, transforms } = collectUpdate(data);
    const w = {
      update: { name: this._name(ref.path), fields: this._encodeTree(fields) },
      updateMask: { fieldPaths: mask.map(f => f.canonical()) },
      currentDocument: { exists: true },
    };
    if (transforms.length) w.updateTransforms = this._transforms(transforms);
    return w;
  }

  _writeCreate(ref, data) {
    const w = this._writeSet(ref, data, {});
    w.currentDocument = { exists: false };
    return w;
  }

  _writeDelete(ref, precondition) {
    const w = { delete: this._name(ref.path) };
    if (precondition && precondition.exists !== undefined) w.currentDocument = { exists: precondition.exists };
    if (precondition && precondition.lastUpdateTime) w.currentDocument = { updateTime: precondition.lastUpdateTime.toISO() };
    return w;
  }

  async _commit(writes, transaction) {
    this.ops.writes += writes.length;
    const res = await this._request(`${this._root}:commit`, { writes, ...(transaction ? { transaction } : {}) });
    const commitTime = res && res.commitTime;
    return ((res && res.writeResults) || writes.map(() => ({}))).map(r => ({
      writeTime: Timestamp.fromISO(r.updateTime || commitTime || new Date().toISOString()),
    }));
  }

  async runTransaction(fn, { maxAttempts = 5 } = {}) {
    let lastErr;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const tx = new Transaction(this);
      let result;
      try {
        result = await fn(tx);
      } catch (e) {
        if (tx._id) await this._request(`${this._root}:rollback`, { transaction: tx._id }).catch(() => {});
        throw e;
      }
      try {
        if (tx._writes.length || tx._id) await this._commit(tx._writes, tx._id);
        return result;
      } catch (e) {
        lastErr = e;
        if (!(e instanceof FirestoreError) || (e.code !== GRPC.ABORTED && e.code !== GRPC.UNAVAILABLE)) throw e;
      }
    }
    throw lastErr;
  }
}

module.exports = {
  Firestore, CollectionReference, DocumentReference, DocumentSnapshot, QuerySnapshot, Query, WriteBatch, Transaction,
  AggregateQuery, FirestoreError, GRPC, autoId,
};
