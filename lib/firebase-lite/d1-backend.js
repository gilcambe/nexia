'use strict';
/**
 * Banco de reserva FORA do Firebase: Cloudflare D1 (grátis: 100 mil gravações e 5 milhões de leituras por dia).
 * Fala o mesmo "idioma" da API REST do Firestore (batchGet, runQuery, commit, rollback, runAggregationQuery),
 * então o Firestore do firebase-lite usa este backend no lugar da rede quando os bancos Firebase esgotam a cota.
 * Os documentos ficam guardados já no formato de Value do Firestore (JSON), numa tabela única.
 */

const RANK = { nullValue: 1, booleanValue: 2, integerValue: 3, doubleValue: 3, timestampValue: 4, stringValue: 5, bytesValue: 6, referenceValue: 7, geoPointValue: 8, arrayValue: 9, mapValue: 10 };
const typeOf = v => Object.keys(v || {}).find(k => RANK[k]) || 'nullValue';
const erro = (status, message) => Object.assign(new Error(message), { status, firestoreStatus: status });

function cmp(a, b) {
  const ta = typeOf(a), tb = typeOf(b);
  if (RANK[ta] !== RANK[tb]) return RANK[ta] < RANK[tb] ? -1 : 1;
  switch (RANK[ta]) {
    case 2: return Number(a.booleanValue) - Number(b.booleanValue);
    case 3: { const x = Number(a.integerValue ?? a.doubleValue), y = Number(b.integerValue ?? b.doubleValue); return x < y ? -1 : x > y ? 1 : 0; }
    case 4: { const x = Date.parse(a.timestampValue), y = Date.parse(b.timestampValue); return x < y ? -1 : x > y ? 1 : 0; }
    case 5: return a.stringValue < b.stringValue ? -1 : a.stringValue > b.stringValue ? 1 : 0;
    case 6: return a.bytesValue < b.bytesValue ? -1 : a.bytesValue > b.bytesValue ? 1 : 0;
    case 7: return a.referenceValue < b.referenceValue ? -1 : a.referenceValue > b.referenceValue ? 1 : 0;
    case 9: {
      const x = a.arrayValue.values || [], y = b.arrayValue.values || [];
      for (let i = 0; i < Math.min(x.length, y.length); i++) { const c = cmp(x[i], y[i]); if (c) return c; }
      return x.length - y.length;
    }
    case 10: {
      const x = a.mapValue.fields || {}, y = b.mapValue.fields || {};
      const kx = Object.keys(x).sort(), ky = Object.keys(y).sort();
      for (let i = 0; i < Math.min(kx.length, ky.length); i++) {
        if (kx[i] !== ky[i]) return kx[i] < ky[i] ? -1 : 1;
        const c = cmp(x[kx[i]], y[ky[i]]); if (c) return c;
      }
      return kx.length - ky.length;
    }
    default: return 0;
  }
}
const iguais = (a, b) => cmp(a, b) === 0;

/** "a.`b.c`.d" → ['a','b.c','d'] */
function splitField(fp) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < fp.length; i++) {
    const ch = fp[i];
    if (q) { if (ch === '\\') cur += fp[++i]; else if (ch === '`') q = false; else cur += ch; } else if (ch === '`') q = true; else if (ch === '.') { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out;
}

function getPath(fields, segs) {
  let cur = { mapValue: { fields } };
  for (const s of segs) {
    if (!cur || !cur.mapValue) return undefined;
    cur = (cur.mapValue.fields || {})[s];
  }
  return cur;
}
function setPath(fields, segs, val) {
  let f = fields;
  for (let i = 0; i < segs.length - 1; i++) {
    const nxt = f[segs[i]];
    if (!nxt || !nxt.mapValue) f[segs[i]] = { mapValue: { fields: {} } };
    if (!f[segs[i]].mapValue.fields) f[segs[i]].mapValue.fields = {};
    f = f[segs[i]].mapValue.fields;
  }
  if (val === undefined) delete f[segs[segs.length - 1]]; else f[segs[segs.length - 1]] = val;
}

const clone = o => JSON.parse(JSON.stringify(o));
const stamp = () => `${new Date().toISOString().slice(0, 23)}${String(Math.floor(Math.random() * 1e6)).padStart(6, '0')}Z`;

// ─── drivers ──────────────────────────────────────────────────────────────
/** Em memória (testes e simulações). Mesma interface do driver D1. */
function createMemoryDriver() {
  const docs = new Map();
  return {
    docs,
    async get(paths) { const m = new Map(); for (const p of paths) if (docs.has(p)) m.set(p, clone(docs.get(p))); return m; },
    async list(parent, collectionId, allDescendants) {
      const out = [];
      for (const [path, d] of docs) {
        const segs = path.split('/');
        const col = segs[segs.length - 2];
        const par = segs.slice(0, -2).join('/');
        if (col !== collectionId) continue;
        if (!allDescendants && par !== parent) continue;
        if (allDescendants && parent && !(`${par}/`).startsWith(`${parent}/`) && par !== parent) continue;
        out.push({ path, ...clone(d) });
      }
      return out;
    },
    async apply(ops) {
      for (const o of ops) if (o.type === 'insert' && docs.has(o.path)) throw erro('ALREADY_EXISTS', 'Documento já existe.');
      for (const o of ops) {
        if (o.type === 'delete') docs.delete(o.path);
        else docs.set(o.path, { fields: o.fields, create_time: o.create_time, update_time: o.update_time });
      }
    },
  };
}

/** Cloudflare D1 via API REST (funciona no GitHub Actions e no Worker). Banco achado pelo nome; tabela criada na 1ª vez. */
function createD1Driver({ token, accountId, databaseId, databaseName = 'nexia-cortex', fetchImpl = (...a) => fetch(...a) }) {
  if (!token || !accountId) throw new Error('D1: faltam CLOUDFLARE_API_TOKEN e CLOUDFLARE_ACCOUNT_ID.');
  const api = `https://api.cloudflare.com/client/v4/accounts/${accountId}`;
  const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  let idPromise = null;
  let pronto = null;

  async function cf(path, init) {
    const r = await fetchImpl(api + path, { headers: H, ...init });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.success === false) {
      const msg = (j.errors && j.errors[0] && j.errors[0].message) || `Cloudflare respondeu ${r.status}`;
      throw erro(r.status === 429 ? 'RESOURCE_EXHAUSTED' : /UNIQUE|constraint/i.test(msg) ? 'ALREADY_EXISTS' : 'UNAVAILABLE', `D1: ${msg}`);
    }
    return j;
  }
  const dbId = () => (idPromise ||= (async () => {
    if (databaseId) return databaseId;
    const j = await cf(`/d1/database?name=${encodeURIComponent(databaseName)}`);
    const hit = (j.result || []).find(d => d.name === databaseName);
    if (hit) return hit.uuid;
    const c = await cf('/d1/database', { method: 'POST', body: JSON.stringify({ name: databaseName }) });
    return c.result.uuid;
  })().catch(e => { idPromise = null; throw e; }));
  async function sql(stmts) {
    const id = await dbId();
    if (!pronto) {
      pronto = cf(`/d1/database/${id}/query`, { method: 'POST', body: JSON.stringify({ sql: 'CREATE TABLE IF NOT EXISTS docs (path TEXT PRIMARY KEY, parent TEXT NOT NULL, col TEXT NOT NULL, fields TEXT NOT NULL, create_time TEXT NOT NULL, update_time TEXT NOT NULL)' }) })
        .then(() => cf(`/d1/database/${id}/query`, { method: 'POST', body: JSON.stringify({ sql: 'CREATE INDEX IF NOT EXISTS docs_col ON docs (col, parent)' }) })).catch(e => { pronto = null; throw e; });
    }
    await pronto;
    const j = await cf(`/d1/database/${id}/query`, { method: 'POST', body: JSON.stringify(stmts.length === 1 ? stmts[0] : stmts) });
    return Array.isArray(j.result) ? j.result.map(r => r.results || []) : [];
  }
  const row = r => ({ path: r.path, fields: JSON.parse(r.fields), create_time: r.create_time, update_time: r.update_time });
  return {
    async get(paths) {
      const m = new Map();
      for (let i = 0; i < paths.length; i += 50) {
        const part = paths.slice(i, i + 50);
        const [rows] = await sql([{ sql: `SELECT * FROM docs WHERE path IN (${part.map(() => '?').join(',')})`, params: part }]);
        for (const r of rows) m.set(r.path, row(r));
      }
      return m;
    },
    async list(parent, collectionId, allDescendants) {
      const [rows] = await sql([allDescendants
        ? { sql: 'SELECT * FROM docs WHERE col = ?', params: [collectionId] }
        : { sql: 'SELECT * FROM docs WHERE col = ? AND parent = ?', params: [collectionId, parent] }]);
      const out = rows.map(row);
      return allDescendants && parent ? out.filter(d => d.path.startsWith(`${parent}/`)) : out;
    },
    async apply(ops) {
      if (!ops.length) return;
      const stmts = ops.map(o => {
        if (o.type === 'delete') return { sql: 'DELETE FROM docs WHERE path = ?', params: [o.path] };
        const segs = o.path.split('/');
        const params = [o.path, segs.slice(0, -2).join('/'), segs[segs.length - 2], JSON.stringify(o.fields), o.create_time, o.update_time];
        return o.type === 'insert'
          ? { sql: 'INSERT INTO docs (path, parent, col, fields, create_time, update_time) VALUES (?,?,?,?,?,?)', params }
          : { sql: 'INSERT INTO docs (path, parent, col, fields, create_time, update_time) VALUES (?,?,?,?,?,?) ON CONFLICT(path) DO UPDATE SET fields=excluded.fields, update_time=excluded.update_time', params };
      });
      for (let i = 0; i < stmts.length; i += 90) await sql(stmts.slice(i, i + 90));
    },
  };
}

// ─── backend (traduz as chamadas REST do Firestore) ───────────────────────
function createD1Backend({ driver, projectId = 'nexia-d1' }) {
  const root = `projects/${projectId}/databases/(default)/documents`;
  const rel = name => (name.startsWith(`${root}/`) ? name.slice(root.length + 1) : name === root ? '' : name.replace(/^projects\/[^/]+\/databases\/[^/]+\/documents\/?/, ''));
  const full = path => `${root}/${path}`;
  const txReads = new Map(); // id da transação → Map(path → update_time | null)

  const toDoc = (path, d) => ({ name: full(path), fields: d.fields, createTime: d.create_time, updateTime: d.update_time });

  function openTx(body) {
    if (body.newTransaction) { const id = `d1tx_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`; txReads.set(id, new Map()); return id; }
    if (body.transaction) { if (!txReads.has(body.transaction)) txReads.set(body.transaction, new Map()); return body.transaction; }
    return null;
  }
  const note = (tx, path, d) => { if (tx) txReads.get(tx).set(path, d ? d.update_time : null); };

  async function batchGet(body) {
    const tx = openTx(body);
    const paths = body.documents.map(rel);
    const got = await driver.get(paths);
    const now = new Date().toISOString();
    const out = body.documents.map((n, i) => {
      const d = got.get(paths[i]);
      note(tx, paths[i], d);
      return d ? { found: toDoc(paths[i], d), readTime: now } : { missing: n, readTime: now };
    });
    if (tx && out.length) out[0].transaction = tx;
    return out;
  }

  // filtros
  function valorDoc(path, doc, fp) {
    if (fp === '__name__') return { referenceValue: full(path) };
    return getPath(doc.fields, splitField(fp));
  }
  function passa(filter, path, doc) {
    if (!filter) return true;
    if (filter.compositeFilter) {
      const r = filter.compositeFilter.filters.map(f => passa(f, path, doc));
      return filter.compositeFilter.op === 'OR' ? r.some(Boolean) : r.every(Boolean);
    }
    if (filter.unaryFilter) {
      const { field, op } = filter.unaryFilter;
      const v = valorDoc(path, doc, field.fieldPath);
      if (op === 'IS_NULL') return !!v && 'nullValue' in v;
      if (op === 'IS_NOT_NULL') return !!v && !('nullValue' in v);
      const nan = !!v && 'doubleValue' in v && String(v.doubleValue) === 'NaN';
      return op === 'IS_NAN' ? nan : (!!v && !nan);
    }
    const { field, op, value } = filter.fieldFilter;
    const v = valorDoc(path, doc, field.fieldPath);
    if (v === undefined) return false;
    switch (op) {
      case 'EQUAL': return iguais(v, value);
      case 'NOT_EQUAL': return !iguais(v, value);
      case 'LESS_THAN': return RANK[typeOf(v)] === RANK[typeOf(value)] && cmp(v, value) < 0;
      case 'LESS_THAN_OR_EQUAL': return RANK[typeOf(v)] === RANK[typeOf(value)] && cmp(v, value) <= 0;
      case 'GREATER_THAN': return RANK[typeOf(v)] === RANK[typeOf(value)] && cmp(v, value) > 0;
      case 'GREATER_THAN_OR_EQUAL': return RANK[typeOf(v)] === RANK[typeOf(value)] && cmp(v, value) >= 0;
      case 'IN': return (value.arrayValue.values || []).some(x => iguais(v, x));
      case 'NOT_IN': return !(value.arrayValue.values || []).some(x => iguais(v, x));
      case 'ARRAY_CONTAINS': return !!v.arrayValue && (v.arrayValue.values || []).some(x => iguais(x, value));
      case 'ARRAY_CONTAINS_ANY': return !!v.arrayValue && (v.arrayValue.values || []).some(x => (value.arrayValue.values || []).some(y => iguais(x, y)));
      default: throw erro('INVALID_ARGUMENT', `Operador não suportado: ${op}`);
    }
  }

  async function consulta(parentName, sq) {
    const parent = rel(parentName);
    const from = sq.from[0];
    let rows = await driver.list(parent, from.collectionId, !!from.allDescendants);
    rows = rows.filter(r => passa(sq.where, r.path, r));
    const ord = (sq.orderBy || []).map(o => ({ fp: o.field.fieldPath, dir: o.direction === 'DESCENDING' ? -1 : 1 }));
    // Firestore só devolve documentos que têm todos os campos do orderBy.
    rows = rows.filter(r => ord.every(o => o.fp === '__name__' || valorDoc(r.path, r, o.fp) !== undefined));
    const chaves = ord.length ? ord : [{ fp: '__name__', dir: 1 }];
    const comparar = (a, b) => {
      for (const o of chaves) { const c = cmp(valorDoc(a.path, a, o.fp), valorDoc(b.path, b, o.fp)); if (c) return c * o.dir; }
      return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
    };
    rows.sort(comparar);
    const corte = (cur, antes, dentro) => {
      const vs = cur.values;
      return r => {
        let c = 0;
        for (let i = 0; i < vs.length && !c; i++) { const o = chaves[i] || { fp: '__name__', dir: 1 }; c = cmp(valorDoc(r.path, r, o.fp), vs[i]) * o.dir; }
        return dentro(c, antes);
      };
    };
    if (sq.startAt) { const f = corte(sq.startAt, sq.startAt.before, (c, antes) => (antes ? c >= 0 : c > 0)); rows = rows.filter(f); }
    if (sq.endAt) { const f = corte(sq.endAt, sq.endAt.before, (c, antes) => (antes ? c < 0 : c <= 0)); rows = rows.filter(f); }
    return rows;
  }

  async function runQuery(parentName, body) {
    const tx = openTx(body);
    let rows = await consulta(parentName, body.structuredQuery);
    const sq = body.structuredQuery;
    if (sq.offset) rows = rows.slice(sq.offset);
    if (sq.limit !== undefined) rows = rows.slice(0, sq.limit);
    for (const r of rows) note(tx, r.path, r);
    const now = new Date().toISOString();
    const out = rows.map(r => {
      let doc = toDoc(r.path, r);
      if (sq.select) {
        const fields = {};
        for (const f of sq.select.fields) if (f.fieldPath !== '__name__') { const segs = splitField(f.fieldPath); const v = getPath(r.fields, segs); if (v !== undefined) setPath(fields, segs, clone(v)); }
        doc = { ...doc, fields };
      }
      return { document: doc, readTime: now };
    });
    if (!out.length) out.push({ readTime: now });
    if (tx) out[0].transaction = tx;
    return out;
  }

  async function aggregate(parentName, body) {
    const rows = await consulta(parentName, body.structuredAggregationQuery.structuredQuery);
    const n = body.structuredAggregationQuery.structuredQuery.limit !== undefined ? Math.min(rows.length, body.structuredAggregationQuery.structuredQuery.limit) : rows.length;
    return [{ result: { aggregateFields: { count: { integerValue: String(n) } } }, readTime: new Date().toISOString() }];
  }

  function transformar(fields, t, agora) {
    const segs = splitField(t.fieldPath);
    const atual = getPath(fields, segs);
    if (t.setToServerValue) return setPath(fields, segs, { timestampValue: agora });
    if (t.increment) {
      const a = atual && ('integerValue' in atual || 'doubleValue' in atual) ? Number(atual.integerValue ?? atual.doubleValue) : 0;
      const b = Number(t.increment.integerValue ?? t.increment.doubleValue);
      const s = a + b;
      return setPath(fields, segs, Number.isInteger(s) && !('doubleValue' in t.increment) && !(atual && 'doubleValue' in atual) ? { integerValue: String(s) } : { doubleValue: s });
    }
    const lista = atual && atual.arrayValue ? [...(atual.arrayValue.values || [])] : [];
    if (t.appendMissingElements) { for (const v of t.appendMissingElements.values) if (!lista.some(x => iguais(x, v))) lista.push(v); return setPath(fields, segs, { arrayValue: { values: lista } }); }
    if (t.removeAllFromArray) { const rem = t.removeAllFromArray.values; return setPath(fields, segs, { arrayValue: { values: lista.filter(x => !rem.some(v => iguais(x, v))) } }); }
    throw erro('INVALID_ARGUMENT', 'Transformação não suportada.');
  }

  async function commit(body) {
    const writes = body.writes || [];
    const agora = stamp();
    const alvo = w => rel(w.update ? w.update.name : w.delete);
    const paths = [...new Set(writes.map(alvo))];
    const vistos = (body.transaction && txReads.get(body.transaction)) || new Map();
    const atuais = await driver.get([...new Set([...paths, ...vistos.keys()])]);
    if (body.transaction) {
      for (const [p, ut] of vistos) {
        const d = atuais.get(p);
        if ((d ? d.update_time : null) !== ut) { txReads.delete(body.transaction); throw erro('ABORTED', 'Documento mudou durante a transação.'); }
      }
      txReads.delete(body.transaction);
    }
    const mem = new Map(paths.map(p => [p, atuais.has(p) ? { ...clone(atuais.get(p)) } : null]));
    const criados = new Set();
    const resultados = [];
    for (const w of writes) {
      const p = alvo(w);
      const ex = mem.get(p);
      const pre = w.currentDocument;
      if (pre) {
        if (pre.exists === true && !ex) throw erro('NOT_FOUND', `Documento não existe: ${p}`);
        if (pre.exists === false && ex) throw erro('ALREADY_EXISTS', `Documento já existe: ${p}`);
        if (pre.updateTime && (!ex || ex.update_time !== pre.updateTime)) throw erro('FAILED_PRECONDITION', 'Precondição de updateTime falhou.');
      }
      if (w.delete) { mem.set(p, null); resultados.push({}); continue; }
      let fields;
      if (w.updateMask) {
        fields = ex ? clone(ex.fields) : {};
        for (const fp of w.updateMask.fieldPaths) {
          const segs = splitField(fp);
          setPath(fields, segs, getPath(w.update.fields || {}, segs) === undefined ? undefined : clone(getPath(w.update.fields || {}, segs)));
        }
      } else fields = clone(w.update.fields || {});
      for (const t of w.updateTransforms || []) transformar(fields, t, agora);
      const novo = { fields, create_time: ex ? ex.create_time : agora, update_time: agora };
      if (!ex) criados.add(p);
      mem.set(p, novo);
      resultados.push({ updateTime: agora });
    }
    const ops = [];
    for (const [p, d] of mem) {
      const antes = atuais.get(p);
      if (d === null) { if (antes) ops.push({ type: 'delete', path: p }); continue; }
      ops.push({ type: criados.has(p) && !antes ? 'insert' : 'put', path: p, ...d });
    }
    await driver.apply(ops);
    return { commitTime: agora, writeResults: resultados };
  }

  return {
    root,
    projectId,
    /** Mesma assinatura de Firestore._request(path, body). */
    async request(path, body) {
      const i = path.lastIndexOf(':');
      const base = path.slice(0, i), metodo = path.slice(i + 1);
      switch (metodo) {
        case 'batchGet': return batchGet(body);
        case 'runQuery': return runQuery(base, body);
        case 'runAggregationQuery': return aggregate(base, body);
        case 'commit': return commit(body);
        case 'rollback': txReads.delete(body.transaction); return {};
        default: throw erro('UNIMPLEMENTED', `D1: método ${metodo} não suportado.`);
      }
    },
  };
}

module.exports = { createD1Backend, createD1Driver, createMemoryDriver, cmp, splitField };
