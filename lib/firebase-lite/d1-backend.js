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

// Contador de uso por banco (leituras e escritas do dia) para D1
const usoDiarioD1 = new Map(); // banco -> { data, leituras, escritas }

function registrarUsoD1(banco, leituras = 0, escritas = 0) {
  const hoje = new Date().toISOString().slice(0, 10);
  const key = banco || 'd1-default';
  let cur = usoDiarioD1.get(key);
  if (!cur || cur.data !== hoje) {
    cur = { data: hoje, leituras: 0, escritas: 0 };
    usoDiarioD1.set(key, cur);
  }
  cur.leituras += leituras;
  cur.escritas += escritas;
  
  // Limites D1: 5M leituras / 100k escritas. 70% = 3.5M / 70k.
  const maxL = 5000000;
  const maxE = 100000;
  if (cur.leituras >= maxL * 0.7 || cur.escritas >= maxE * 0.7) {
    try {
      console.warn(`[SENTINEL ALERT] Banco D1 (${key}) atingiu 70% da cota! Leituras: ${cur.leituras}, Escritas: ${cur.escritas}.`);
    } catch {}
  }
}

function getUsoD1(banco) {
  return usoDiarioD1.get(banco || 'd1-default') || { data: new Date().toISOString().slice(0, 10), leituras: 0, escritas: 0 };
}

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
    case 8: return JSON.stringify(a.geoPointValue) < JSON.stringify(b.geoPointValue) ? -1 : 1;
    case 9: return (a.arrayValue.values || []).length - (b.arrayValue.values || []).length;
    case 10: return Object.keys(a.mapValue.fields || {}).length - Object.keys(b.mapValue.fields || {}).length;
    default: return 0;
  }
}

function matchFilter(doc, f) {
  if (!f) return true;
  if (f.compositeFilter) {
    const op = f.compositeFilter.op;
    const filters = f.compositeFilter.filters || [];
    if (op === 'AND') return filters.every(sub => matchFilter(doc, sub));
    if (op === 'OR') return filters.some(sub => matchFilter(doc, sub));
    return true;
  }
  const fld = f.fieldFilter;
  if (!fld) return true;
  const fieldPath = fld.field.fieldPath;
  const op = fld.op;
  const targetVal = fld.value;
  
  const getFieldVal = (d, path) => {
    const parts = path.split('.');
    let cur = d;
    for (const p of parts) {
      if (!cur || !cur.fields) return undefined;
      cur = cur.fields[p];
    }
    return cur;
  };
  
  const val = fieldPath === '__name__' ? { referenceValue: doc.name } : getFieldVal(doc, fieldPath);
  if (val === undefined && op !== 'NOT_EQUAL' && op !== 'NOT_IN') return false;
  
  const c = val ? cmp(val, targetVal) : -1;
  switch (op) {
    case 'LESS_THAN': return c < 0;
    case 'LESS_THAN_OR_EQUAL': return c <= 0;
    case 'GREATER_THAN': return c > 0;
    case 'GREATER_THAN_OR_EQUAL': return c >= 0;
    case 'EQUAL': return c === 0;
    case 'NOT_EQUAL': return c !== 0;
    case 'ARRAY_CONTAINS': return Array.isArray(val?.arrayValue?.values) && val.arrayValue.values.some(v => cmp(v, targetVal) === 0);
    case 'IN': return Array.isArray(targetVal?.arrayValue?.values) && targetVal.arrayValue.values.some(v => cmp(val, v) === 0);
    case 'NOT_IN': return Array.isArray(targetVal?.arrayValue?.values) && !targetVal.arrayValue.values.some(v => cmp(val, v) === 0);
    default: return true;
  }
}

function createD1Backend({ driver, projectId = 'nexia-d1' }) {
  if (driver && typeof driver.registrarUso === 'function') {
    // Integração com contador externo
  }
  if (!driver || typeof driver.exec !== 'function') {
    throw new Error('createD1Backend exige um driver com método exec(sql, params).');
  }

  // Inicializa tabela do D1
  try {
    driver.exec(`CREATE TABLE IF NOT EXISTS firestore_docs (
      path TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );`);
  } catch {}

  return {
    projectId,
    async batchGet(names) {
      registrarUsoD1(projectId, names.length, 0);
      const res = [];
      for (const name of names) {
        const rows = driver.exec(`SELECT data FROM firestore_docs WHERE path = ?`, name);
        const row = rows[0] || (rows.toArray && rows.toArray()[0]);
        if (row && row.data) {
          try {
            res.push({ found: JSON.parse(row.data) });
            continue;
          } catch {}
        }
        res.push({ missing: name });
      }
      return res;
    },
    async commit(writes) {
      registrarUsoD1(projectId, 0, writes.length);
      const now = new Date().toISOString();
      for (const w of writes) {
        if (w.update) {
          const path = w.update.name;
          const dataStr = JSON.stringify(w.update);
          driver.exec(`INSERT INTO firestore_docs (path, data, updated_at) VALUES (?, ?, ?)
            ON CONFLICT(path) DO UPDATE SET data = ?, updated_at = ?`, path, dataStr, now, dataStr, now);
        } else if (w.delete) {
          const path = w.delete;
          driver.exec(`DELETE FROM firestore_docs WHERE path = ?`, path);
        }
      }
      return { commitTime: now };
    },
    async runQuery(parent, structuredQuery) {
      registrarUsoD1(projectId, 10, 0); // consulta conta como várias leituras estimadas
      const rows = driver.exec(`SELECT data FROM firestore_docs`);
      const list = (rows.toArray ? rows.toArray() : rows).map(r => {
        try { return JSON.parse(r.data); } catch { return null; }
      }).filter(Boolean);

      const fromCollection = structuredQuery.from?.[0]?.collectionId;
      const filtered = list.filter(doc => {
        if (!doc.name) return false;
        if (fromCollection && !doc.name.includes(`/${fromCollection}/`)) return false;
        const rootQuery = structuredQuery.where ? matchFilter(doc, structuredQuery.where) : true;
        return rootQuery;
      });

      if (structuredQuery.orderBy) {
        for (const ob of structuredQuery.orderBy.reverse()) {
          const fieldPath = ob.field.fieldPath;
          const dir = ob.direction === 'DESCENDING' ? -1 : 1;
          filtered.sort((a, b) => {
            const getFieldVal = (d, path) => {
              const parts = path.split('.');
              let cur = d;
              for (const p of parts) {
                if (!cur || !cur.fields) return undefined;
                cur = cur.fields[p];
              }
              return cur;
            };
            const va = getFieldVal(a, fieldPath);
            const vb = getFieldVal(b, fieldPath);
            return cmp(va, vb) * dir;
          });
        }
      }

      if (structuredQuery.offset) filtered.splice(0, structuredQuery.offset);
      if (structuredQuery.limit) filtered.splice(structuredQuery.limit);

      return filtered.map(doc => ({ document: doc, readTime: new Date().toISOString() }));
    },
    async runAggregationQuery(parent, structuredAggregationQuery) {
      registrarUsoD1(projectId, 5, 0);
      const rows = driver.exec(`SELECT data FROM firestore_docs`);
      const list = (rows.toArray ? rows.toArray() : rows).map(r => {
        try { return JSON.parse(r.data); } catch { return null; }
      }).filter(Boolean);
      return [{ result: { aggregateFields: { count: { integerValue: String(list.length) } } }, readTime: new Date().toISOString() }];
    },
    getUso() {
      return getUsoD1(projectId);
    }
  };
}

module.exports = { createD1Backend, registrarUsoD1, getUsoD1 };
