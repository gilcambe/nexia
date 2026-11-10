'use strict';
// Camada adaptadora: imita a parte do Firestore que o Viajante Pro usa
// (collection / doc / get / set / update / delete / add / where / orderBy / limit)
// e grava num banco SQL (MySQL da Hostinger em produção; SQLite nos testes).
// Assim netlify/functions/viajante-pro.js roda SEM nenhuma mudança na lógica.
//
// Tudo fica numa tabela só: vp_documentos(caminho, colecao, doc_id, dados JSON).
//   caminho = "viajante_contas/viajantepro/cotacoes/abc123"
//   colecao = "viajante_contas/viajantepro/cotacoes"

const crypto = require('node:crypto');

const AUTO_ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
function autoId() {
  const bytes = crypto.randomBytes(20);
  let id = '';
  for (let i = 0; i < 20; i++) id += AUTO_ID_CHARS[bytes[i] % AUTO_ID_CHARS.length];
  return id;
}

function validarId(id) {
  const s = String(id);
  if (!s || s.includes('/') || s.length > 190) throw new Error(`ID de documento inválido: ${s.slice(0, 40)}`);
  return s;
}

// Valores especiais (FieldValue) vindos do navegador ou do servidor.
const FV = {
  serverTimestamp: () => ({ __fv: 'ts' }),
  increment: n => ({ __fv: 'inc', n: Number(n) || 0 }),
  arrayUnion: (...v) => ({ __fv: 'union', v }),
  arrayRemove: (...v) => ({ __fv: 'remove', v }),
  delete: () => ({ __fv: 'del' }),
};

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date);
}

function resolverValor(novo, antigo) {
  if (novo instanceof Date) return novo.toISOString();
  if (isPlainObject(novo) && novo.__fv) {
    switch (novo.__fv) {
      case 'ts': return new Date().toISOString();
      case 'inc': return (Number(antigo) || 0) + (Number(novo.n) || 0);
      case 'union': { const a = Array.isArray(antigo) ? antigo.slice() : []; for (const x of novo.v || []) if (!a.some(y => JSON.stringify(y) === JSON.stringify(x))) a.push(x); return a; }
      case 'remove': { const a = Array.isArray(antigo) ? antigo : []; const fora = (novo.v || []).map(x => JSON.stringify(x)); return a.filter(y => !fora.includes(JSON.stringify(y))); }
      default: return undefined;
    }
  }
  if (isPlainObject(novo)) {
    const out = {};
    for (const [k, v] of Object.entries(novo)) {
      const r = resolverValor(v, isPlainObject(antigo) ? antigo[k] : undefined);
      if (r !== undefined && !(isPlainObject(v) && v.__fv === 'del')) out[k] = r;
    }
    return out;
  }
  if (Array.isArray(novo)) return novo.map(x => resolverValor(x, undefined));
  return novo;
}

function mesclar(antigo, novo) {
  const out = isPlainObject(antigo) ? { ...antigo } : {};
  for (const [k, v] of Object.entries(novo || {})) {
    if (isPlainObject(v) && v.__fv === 'del') { delete out[k]; continue; }
    if (isPlainObject(v) && !v.__fv && isPlainObject(out[k])) out[k] = mesclar(out[k], v);
    else out[k] = resolverValor(v, out[k]);
  }
  return out;
}

// update() aceita "a.b.c": valor
function aplicarUpdate(antigo, campos) {
  const out = JSON.parse(JSON.stringify(antigo || {}));
  for (const [chave, v] of Object.entries(campos || {})) {
    const partes = chave.split('.');
    let alvo = out;
    for (let i = 0; i < partes.length - 1; i++) {
      if (!isPlainObject(alvo[partes[i]])) alvo[partes[i]] = {};
      alvo = alvo[partes[i]];
    }
    const ult = partes[partes.length - 1];
    if (isPlainObject(v) && v.__fv === 'del') delete alvo[ult];
    else alvo[ult] = resolverValor(v, alvo[ult]);
  }
  return out;
}

function pegarCampo(obj, campo) {
  return String(campo).split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function comparar(a, b) {
  if (a === b) return 0;
  if (a === undefined || a === null) return -1;
  if (b === undefined || b === null) return 1;
  return a < b ? -1 : 1;
}

const OPS = {
  '==': (a, b) => JSON.stringify(a) === JSON.stringify(b),
  '!=': (a, b) => JSON.stringify(a) !== JSON.stringify(b),
  '<': (a, b) => a !== undefined && a < b,
  '<=': (a, b) => a !== undefined && a <= b,
  '>': (a, b) => a !== undefined && a > b,
  '>=': (a, b) => a !== undefined && a >= b,
  'in': (a, b) => Array.isArray(b) && b.some(x => JSON.stringify(x) === JSON.stringify(a)),
  'not-in': (a, b) => Array.isArray(b) && !b.some(x => JSON.stringify(x) === JSON.stringify(a)),
  'array-contains': (a, b) => Array.isArray(a) && a.some(x => JSON.stringify(x) === JSON.stringify(b)),
  'array-contains-any': (a, b) => Array.isArray(a) && Array.isArray(b) && a.some(x => b.some(y => JSON.stringify(x) === JSON.stringify(y))),
};

class DocSnapshot {
  constructor(ref, dados) {
    this.ref = ref;
    this.id = ref.id;
    this.exists = dados !== null && dados !== undefined;
    this._dados = dados;
  }
  data() { return this.exists ? JSON.parse(JSON.stringify(this._dados)) : undefined; }
  get(campo) { return this.exists ? pegarCampo(this._dados, campo) : undefined; }
}

class QuerySnapshot {
  constructor(docs) {
    this.docs = docs;
    this.size = docs.length;
    this.empty = docs.length === 0;
  }
  forEach(fn) { this.docs.forEach(fn); }
}

class DocRef {
  constructor(store, caminho) {
    this._store = store;
    this.path = caminho;
    const partes = caminho.split('/');
    this.id = partes[partes.length - 1];
    this._colecao = partes.slice(0, -1).join('/');
  }
  get parent() { return new CollectionRef(this._store, this._colecao); }
  collection(nome) { return new CollectionRef(this._store, `${this.path}/${validarId(nome)}`); }
  async get() { return new DocSnapshot(this, await this._store._ler(this.path)); }
  async set(dados, opcoes = {}) {
    const antigo = opcoes && opcoes.merge ? await this._store._ler(this.path) : null;
    const novo = opcoes && opcoes.merge ? mesclar(antigo, dados) : resolverValor(dados || {}, undefined);
    await this._store._gravar(this.path, this._colecao, this.id, novo);
  }
  async update(campos) {
    const antigo = await this._store._ler(this.path);
    if (antigo === null) {
      const e = new Error(`Documento não existe: ${this.path}`);
      e.code = 5; // NOT_FOUND, como o Firestore
      throw e;
    }
    await this._store._gravar(this.path, this._colecao, this.id, aplicarUpdate(antigo, campos));
  }
  async delete() { await this._store._apagar(this.path); }
}

class Query {
  constructor(store, colecao, filtros = [], ordem = [], limite = null) {
    this._store = store;
    this._colecao = colecao;
    this._filtros = filtros;
    this._ordem = ordem;
    this._limite = limite;
  }
  where(campo, op, valor) {
    if (!OPS[op]) throw new Error(`Operador não suportado: ${op}`);
    return new Query(this._store, this._colecao, [...this._filtros, { campo, op, valor }], this._ordem, this._limite);
  }
  orderBy(campo, direcao = 'asc') {
    return new Query(this._store, this._colecao, this._filtros, [...this._ordem, { campo, direcao }], this._limite);
  }
  limit(n) { return new Query(this._store, this._colecao, this._filtros, this._ordem, Number(n) || null); }
  async get() {
    const linhas = await this._store._listar(this._colecao);
    let docs = linhas.map(l => ({ id: l.doc_id, dados: l.dados }));
    for (const f of this._filtros) docs = docs.filter(d => OPS[f.op](pegarCampo(d.dados, f.campo), f.valor));
    if (this._ordem.length) {
      docs.sort((x, y) => {
        for (const o of this._ordem) {
          const c = comparar(pegarCampo(x.dados, o.campo), pegarCampo(y.dados, o.campo));
          if (c) return o.direcao === 'desc' ? -c : c;
        }
        return 0;
      });
    }
    if (this._limite) docs = docs.slice(0, this._limite);
    return new QuerySnapshot(docs.map(d => new DocSnapshot(new DocRef(this._store, `${this._colecao}/${d.id}`), d.dados)));
  }
}

class CollectionRef extends Query {
  constructor(store, caminho) {
    super(store, caminho);
    this.path = caminho;
    this.id = caminho.split('/').pop();
  }
  doc(id) { return new DocRef(this._store, `${this.path}/${validarId(id === undefined ? autoId() : id)}`); }
  async add(dados) {
    const ref = this.doc();
    await ref.set(dados);
    return ref;
  }
}

class DocStore {
  // driver: { ler(caminho) -> string|null, listar(colecao) -> [{doc_id, dados:string}], gravar(caminho, colecao, doc_id, json), apagar(caminho) }
  constructor(driver) { this._driver = driver; }
  collection(nome) { return new CollectionRef(this, validarId(nome)); }
  doc(caminho) { return new DocRef(this, String(caminho)); }
  async _ler(caminho) {
    const s = await this._driver.ler(caminho);
    return s == null ? null : JSON.parse(s);
  }
  async _listar(colecao) {
    const linhas = await this._driver.listar(colecao);
    return linhas.map(l => ({ doc_id: l.doc_id, dados: JSON.parse(l.dados) }));
  }
  async _gravar(caminho, colecao, docId, dados) {
    await this._driver.gravar(caminho, colecao, docId, JSON.stringify(dados));
  }
  async _apagar(caminho) { await this._driver.apagar(caminho); }
}

module.exports = { DocStore, FV, autoId, _interno: { mesclar, aplicarUpdate, resolverValor } };
