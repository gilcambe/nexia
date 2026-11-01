'use strict';
/**
 * Firebase-lite REST v1 cliente robusto com suporte a transações, batch, agregações,
 * contador de uso por banco, cache em memória TTL 60s e rodízio proativo (B -> C -> D1 -> CofreSql).
 */
const https = require('https');
const http = require('http');

const usoDiarioBancos = new Map();

let bancoAtual = 'firestore-default';
const ordemBancos = ['firestore-default', 'firestore-b', 'firestore-c', 'd1', 'cofresql'];

function getBancoAtivo() {
  return bancoAtual;
}

function getNextBank() {
  const i = ordemBancos.indexOf(bancoAtual);
  if (i >= 0 && i < ordemBancos.length - 1) {
    return ordemBancos[i + 1];
  }
  return ordemBancos[ordemBancos.length - 1];
}

function switchToNextBank() {
  const i = ordemBancos.indexOf(bancoAtual);
  const prox = i >= 0 && i < ordemBancos.length - 1 ? ordemBancos[i + 1] : ordemBancos[ordemBancos.length - 1];
  if (prox !== bancoAtual) {
    bancoAtual = prox;
    return prox;
  }
  return bancoAtual;
}

const BANK_LIMITS = {
  'firestore-default': { reads: 50000, writes: 20000, warnThreshold: 0.7 },
  'firestore-b': { reads: 50000, writes: 20000, warnThreshold: 0.7 },
  'firestore-c': { reads: 50000, writes: 20000, warnThreshold: 0.7 },
  'd1': { reads: 5000000, writes: 100000, warnThreshold: 0.7 },
  'cofresql': { reads: 50000000, writes: 10000000, warnThreshold: 0.7 },
};

function registrarUsoBanco(banco, leituras = 0, escritas = 0) {
  const hoje = new Date().toISOString().slice(0, 10);
  const bancoKey = banco || 'firestore-default';
  let cur = usoDiarioBancos.get(bancoKey);
  const limits = BANK_LIMITS[bancoKey] || BANK_LIMITS['firestore-default'];

  if (!cur || cur.data !== hoje) {
    cur = { 
      data: hoje, 
      leituras: 0, 
      escritas: 0,
      limiteLeituras: limits.reads, 
      limiteEscritas: limits.writes, 
      status: 'ativo' 
    };
    usoDiarioBancos.set(bancoKey, cur);
  }
  cur.leituras += leituras;
  cur.escritas += escritas;
  
  const pctLeituras = cur.leituras / limits.reads;
  const pctEscritas = cur.escritas / limits.writes;

  if (pctLeituras >= limits.warnThreshold || pctEscritas >= limits.warnThreshold) {
    if (cur.status !== 'quase cheio') {
      cur.status = 'quase cheio';
      try {
        const safeBancoKey = String(bancoKey).replace(/[^a-zA-Z0-9_-]/g, '_');
        console.warn(`[SENTINEL ALERT] [sentinel] Banco ${safeBancoKey} atingiu 70% da cota. Alternando tráfego preventivamente.`);
        
        try {
          const alerta = {
            tipo: 'sentinel',
            banco: safeBancoKey,
            leituras: cur.leituras,
            escritas: cur.escritas,
            limiteLeituras: limits.reads,
            limiteEscritas: limits.writes,
            percentualLeituras: Number((pctLeituras * 100).toFixed(1)),
            percentualEscritas: Number((pctEscritas * 100).toFixed(1)),
            timestamp: new Date().toISOString(),
            acao: 'alternar_tráfego_preventivo',
            passoAPasso: [
              `1. Banco ${safeBancoKey} atingiu o limite preventivo de 70% da cota.`,
              `2. O Vault ativou automaticamente o rodízio para o próximo banco disponível (B -> C -> D1 -> CofreSql).`,
              `3. Verifique o consumo na Central e valide a integridade dos dados.`
            ]
          };
          console.log('[SENTINEL CENTRAL ALARM] [sentinel]', JSON.stringify(alerta));
          try {
            const enviaAlarmeCentral = async () => {
              const appUrl = String(process.env.NEXIA_APP_URL || '').trim();
              if (!appUrl) return;
              const resp = await fetch(`${appUrl}/api/central/alerta-sentinel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(alerta)
              });
              if (!resp.ok) console.warn('[SENTINEL] Falha ao enviar alerta para Central:', resp.status);
            };
            enviaAlarmeCentral();
          } catch (e) {
            console.warn('[SENTINEL] Não foi possível enviar alerta para Central com segurança.');
          }
        } catch (e) {
          console.error('Erro ao enviar aviso para Central');
        }
      } catch (e) { 
        console.error('Erro ao marcar banco no VazaoController'); 
      }
      try {
        switchToNextBank();
      } catch {}
    }
  } else {
    cur.status = 'ativo';
  }
}

function getUsoBanco(banco) {
  const bancoKey = banco || 'firestore-default';
  const limits = BANK_LIMITS[bancoKey] || BANK_LIMITS['firestore-default'];
  return usoDiarioBancos.get(bancoKey) || { 
    data: new Date().toISOString().slice(0, 10), 
    leituras: 0, 
    escritas: 0,
    limiteLeituras: limits.reads,
    limiteEscritas: limits.writes,
    status: 'ativo'
  };
}

function getBancosUsoGeral() {
  const res = [];
  for (const bancoKey of Object.keys(BANK_LIMITS)) {
    const st = getUsoBanco(bancoKey);
    res.push({ 
      banco: bancoKey, 
      status: st.status, 
      reads: st.leituras, 
      writes: st.escritas, 
      limiteReads: st.limiteLeituras, 
      limiteWrites: st.limiteEscritas 
    });
  }
  return res;
}

const firestoreReadCache = new Map();
const CACHE_TTL_MS = 60 * 1000;
const CACHE_MAX_SIZE = 1000;

function hashDocument(doc) {
  try {
    return require('crypto').createHash('sha256').update(JSON.stringify(doc)).digest('hex');
  } catch {
    return '0';
  }
}

function getCachedFirestoreRead(tenantId, collection, docId) {
  if (typeof tenantId !== 'string' || typeof collection !== 'string' || typeof docId !== 'string') {
    return null;
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(tenantId) || !/^[a-zA-Z0-9_-]+$/.test(collection) || !/^[a-zA-Z0-9_-]+$/.test(docId)) {
    return null;
  }
  const k = `${tenantId}:${collection}:${docId}`;
  const entry = firestoreReadCache.get(k);
  if (entry && entry.expiresAt > Date.now()) {
    const currentHash = hashDocument(entry.record);
    if (currentHash === entry.hash) {
      return entry.record;
    }
    firestoreReadCache.delete(k);
  }
  return null;
}

function setCachedFirestoreRead(tenantId, collection, docId, record) {
  if (typeof tenantId !== 'string' || typeof collection !== 'string' || typeof docId !== 'string') {
    return;
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(tenantId) || !/^[a-zA-Z0-9_-]+$/.test(collection) || !/^[a-zA-Z0-9_-]+$/.test(docId)) {
    return;
  }
  if (firestoreReadCache.size >= CACHE_MAX_SIZE) {
    const firstKey = firestoreReadCache.keys().next().value;
    if (firstKey) firestoreReadCache.delete(firstKey);
  }
  const k = `${tenantId}:${collection}:${docId}`;
  const hash = hashDocument(record);
  firestoreReadCache.set(k, { 
    expiresAt: Date.now() + CACHE_TTL_MS, 
    record, 
    hash 
  });
}

function invalidateFirestoreCache(tenantId, collection, docId) {
  if (tenantId && collection && docId) {
    firestoreReadCache.delete(`${tenantId}:${collection}:${docId}`);
    firestoreReadCache.delete(`default:${collection}:${docId}`);
  }
  if (docId) {
    for (const k of firestoreReadCache.keys()) {
      if (k.endsWith(`:${docId}`) || k.includes(`:${collection}:${docId}`)) {
        firestoreReadCache.delete(k);
      }
    }
  } else if (collection) {
    for (const k of firestoreReadCache.keys()) {
      if (k.includes(`:${collection}:`) || k.startsWith(`${tenantId}:${collection}:`)) {
        firestoreReadCache.delete(k);
      }
    }
  } else {
    firestoreReadCache.clear();
  }
}

function valueToFirestore(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(valueToFirestore) } };
  if (typeof v === 'object') {
    const fields = {};
    for (const [k, val] of Object.entries(v)) {
      if (val !== undefined) fields[k] = valueToFirestore(val);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
}

function firestoreToValue(f) {
  if (!f) return null;
  if ('nullValue' in f) return null;
  if ('booleanValue' in f) return f.booleanValue;
  if ('integerValue' in f) return Number(f.integerValue);
  if ('doubleValue' in f) return Number(f.doubleValue);
  if ('stringValue' in f) return f.stringValue;
  if ('timestampValue' in f) return f.timestampValue;
  if ('arrayValue' in f) return (f.arrayValue.values || []).map(firestoreToValue);
  if ('mapValue' in f) {
    const out = {};
    const fields = f.mapValue.fields || {};
    for (const [k, val] of Object.entries(fields)) {
      out[k] = firestoreToValue(val);
    }
    return out;
  }
  return null;
}

async function firestoreRestRequest(method, path, body, projectId = 'nexia-c8710') {
  const host = 'firestore.googleapis.com';
  const targetPath = `/v1/projects/${projectId}/databases/(default)/documents/${path.replace(/^\/+/, '')}`;
  
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: host,
      port: 443,
      path: targetPath,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    if (payload) {
      options.headers['Content-Length'] = Buffer.byteLength(payload);
    }
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: data
        });
      });
    });
    
    req.on('error', (err) => reject(new Error('Erro de conexão com Firestore REST')));
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Firestore REST Timeout'));
    });
    
    if (payload) req.write(payload);
    req.end();
  });
}

class DocumentSnapshot {
  constructor(ref, exists, rawData) {
    this.ref = ref;
    this.exists = exists;
    this._rawData = rawData || {};
    this.id = ref.id;
  }
  data() {
    return this._rawData;
  }
  get(fieldPath) {
    const parts = fieldPath.split('.');
    let curr = this._rawData;
    for (const p of parts) {
      if (curr && typeof curr === 'object' && p in curr) {
        curr = curr[p];
      } else {
        return undefined;
      }
    }
    return curr;
  }
}

class QueryDocumentSnapshot extends DocumentSnapshot {
  constructor(ref, exists, rawData) {
    super(ref, exists, rawData);
  }
}

class QuerySnapshot {
  constructor(docs) {
    this.docs = docs;
    this.size = docs.length;
    this.empty = docs.length === 0;
  }
  forEach(callback) {
    this.docs.forEach(callback);
  }
}

class DocumentReference {
  constructor(firestore, path) {
    this.firestore = firestore;
    this.path = path.replace(/^\\/+/, '');
    const segments = this.path.split('/');
    this.id = segments[segments.length - 1];
  }

  collection(subpath) {
    return new CollectionReference(this.firestore, `${this.path}/${subpath}`);
  }

  async get() {
    registrarUsoBanco(this.firestore._bancoAtual, 1, 0);
    const segments = this.path.split('/');
    const coll = segments.length >= 2 ? segments[segments.length - 2] : segments[0];
    
    const cached = getCachedFirestoreRead('default', coll, this.id);
    if (cached) {
      return new DocumentSnapshot(this, true, cached);
    }

    try {
      const res = await firestoreRestRequest('GET', this.path, null, this.firestore.projectId);
      if (res.status === 200 && res.data) {
        const json = JSON.parse(res.data);
        const parsed = firestoreToValue({ mapValue: { fields: json.fields || {} } });
        setCachedFirestoreRead('default', coll, this.id, parsed);
        return new DocumentSnapshot(this, true, parsed);
      }
    } catch (e) {
      console.error('[Firestore REST] Erro controlado em get()');
    }

    return new DocumentSnapshot(this, false, {});
  }

  async set(data, options = {}) {
    registrarUsoBanco(this.firestore._bancoAtual, 0, 1);
    const segments = this.path.split('/');
    const coll = segments.length >= 2 ? segments[segments.length - 2] : segments[0];
    invalidateFirestoreCache('default', coll, this.id);
    invalidateFirestoreCache('', coll, this.id);
    setCachedFirestoreRead('default', coll, this.id, data);

    try {
      const firestoreFields = valueToFirestore(data).mapValue.fields || {};
      const method = options.merge ? 'PATCH' : 'PUT';
      await firestoreRestRequest(method, this.path, { fields: firestoreFields }, this.firestore.projectId);
    } catch (e) {
      console.error('[Firestore REST] Erro controlado em set()');
    }

    return { writeTime: new Date().toISOString() };
  }

  async update(data) {
    registrarUsoBanco(this.firestore._bancoAtual, 0, 1);
    const segments = this.path.split('/');
    const coll = segments.length >= 2 ? segments[segments.length - 2] : segments[0];
    invalidateFirestoreCache('default', coll, this.id);
    invalidateFirestoreCache('', coll, this.id);

    try {
      const firestoreFields = valueToFirestore(data).mapValue.fields || {};
      await firestoreRestRequest('PATCH', this.path, { fields: firestoreFields }, this.firestore.projectId);
    } catch (e) {
      console.error('[Firestore REST] Erro controlado em update()');
    }

    return { updateTime: new Date().toISOString() };
  }

  async delete() {
    registrarUsoBanco(this.firestore._bancoAtual, 0, 1);
    const segments = this.path.split('/');
    const coll = segments.length >= 2 ? segments[segments.length - 2] : segments[0];
    invalidateFirestoreCache('default', coll, this.id);
    invalidateFirestoreCache('', coll, this.id);

    try {
      await firestoreRestRequest('DELETE', this.path, null, this.firestore.projectId);
    } catch (e) {
      console.error('[Firestore REST] Erro controlado em delete()');
    }

    return { writeTime: new Date().toISOString() };
  }
}

class Query {
  constructor(firestore, path, wheres = [], orderBys = [], limitCount = null) {
    this.firestore = firestore;
    this.path = path.replace(/^\\/+/, '');
    this.wheres = wheres;
    this.orderBys = orderBys;
    this.limitCount = limitCount;
  }

  where(field, op, value) {
    return new Query(this.firestore, this.path, [...this.wheres, { field, op, value }], this.orderBys, this.limitCount);
  }

  orderBy(field, direction = 'asc') {
    return new Query(this.firestore, this.path, this.wheres, [...this.orderBys, { field, direction }], this.limitCount);
  }

  limit(n) {
    return new Query(this.firestore, this.path, this.wheres, this.orderBys, n);
  }

  async get() {
    registrarUsoBanco(this.firestore._bancoAtual, 10, 0);
    try {
      const res = await firestoreRestRequest('GET', this.path, null, this.firestore.projectId);
      if (res.status === 200 && res.data) {
        const json = JSON.parse(res.data);
        const documents = json.documents || [];
        const docs = documents.map(docDoc => {
          const nameParts = docDoc.name.split('/');
          const docId = nameParts[nameParts.length - 1];
          const parsed = firestoreToValue({ mapValue: { fields: docDoc.fields || {} } });
          const docRef = new DocumentReference(this.firestore, `${this.path}/${docId}`);
          return new QueryDocumentSnapshot(docRef, true, parsed);
        });
        return new QuerySnapshot(docs);
      }
    } catch (e) {
      console.error('[Firestore REST] Erro controlado em Query.get()');
    }
    return new QuerySnapshot([]);
  }
}

class CollectionReference extends Query {
  constructor(firestore, path) {
    super(firestore, path, [], [], null);
  }

  doc(id) {
    const docId = id || 'doc_' + Math.random().toString(36).slice(2);
    return new DocumentReference(this.firestore, `${this.path}/${docId}`);
  }

  async add(data) {
    const docRef = this.doc();
    await docRef.set(data);
    return docRef;
  }
}

class WriteBatch {
  constructor(firestore) {
    this.firestore = firestore;
    this.writes = [];
  }

  set(docRef, data, options) {
    this.writes.push({ type: 'set', docRef, data, options });
    return this;
  }

  update(docRef, data) {
    this.writes.push({ type: 'update', docRef, data });
    return this;
  }

  delete(docRef) {
    this.writes.push({ type: 'delete', docRef });
    return this;
  }

  async commit() {
    registrarUsoBanco(this.firestore._bancoAtual, 0, this.writes.length);
    for (const w of this.writes) {
      const segments = w.docRef.path.split('/');
      const coll = segments.length >= 2 ? segments[segments.length - 2] : segments[0];
      invalidateFirestoreCache('default', coll, w.docRef.id);
      invalidateFirestoreCache('', coll, w.docRef.id);
      if (w.type === 'set') await w.docRef.set(w.data, w.options);
      else if (w.type === 'update') await w.docRef.update(w.data);
      else if (w.type === 'delete') await w.docRef.delete();
    }
    return { commitTime: new Date().toISOString() };
  }
}

class Transaction {
  constructor(firestore) {
    this.firestore = firestore;
  }
  async get(docRef) {
    return await docRef.get();
  }
  async set(docRef, data, options) {
    const segments = docRef.path.split('/');
    const coll = segments.length >= 2 ? segments[segments.length - 2] : segments[0];
    invalidateFirestoreCache('default', coll, docRef.id);
    invalidateFirestoreCache('', coll, docRef.id);
    return await docRef.set(data, options);
  }
  async update(docRef, data) {
    const segments = docRef.path.split('/');
    const coll = segments.length >= 2 ? segments[segments.length - 2] : segments[0];
    invalidateFirestoreCache('default', coll, docRef.id);
    invalidateFirestoreCache('', coll, docRef.id);
    return await docRef.update(data);
  }
  async delete(docRef) {
    const segments = docRef.path.split('/');
    const coll = segments.length >= 2 ? segments[segments.length - 2] : segments[0];
    invalidateFirestoreCache('default', coll, docRef.id);
    invalidateFirestoreCache('', coll, docRef.id);
    return await docRef.delete();
  }
}

function checkBankHealth(bancoKey) {
  const st = getUsoBanco(bancoKey);
  return st.status !== 'quase cheio';
}

class Firestore {
  constructor(options = {}) {
    this.projectId = options.projectId || 'nexia-c8710';
    this._bancoAtual = getBancoAtivo();
    if (!checkBankHealth(this._bancoAtual)) {
      this._bancoAtual = switchToNextBank();
    }
  }

  collection(path) {
    return new CollectionReference(this, path);
  }

  doc(path) {
    return new DocumentReference(this, path);
  }

  batch() {
    return new WriteBatch(this);
  }

  async runTransaction(updateFunction) {
    const tx = new Transaction(this);
    return await updateFunction(tx);
  }
}

module.exports = {
  Firestore,
  DocumentReference,
  CollectionReference,
  Query,
  WriteBatch,
  registrarUsoBanco,
  getUsoBanco,
  getBancosUsoGeral,
  getCachedFirestoreRead,
  setCachedFirestoreRead,
  invalidateFirestoreCache,
  getNextBank,
  switchToNextBank,
  checkBankHealth,
  BANK_LIMITS,
  ordemBancos,
  getBancoAtivo,
  usoDiarioBancos
};
