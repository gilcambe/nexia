/* Viajante Pro na Hostinger: substitui o SDK do Firebase (gstatic) nas páginas antigas
 * (vp-guide.html, vp-passenger.html, vp-landing.html) com a MESMA interface usada por
 * /core/nexia-boot.js, /core/auth.js, /core/bridge.js e pelas páginas:
 *   firebase.initializeApp / apps / app / firestore() / auth() / firestore.FieldValue
 * O banco vai para /api/vp-docs (MySQL). Não há contas Firebase: auth() fica sempre "sem login",
 * que é o mesmo comportamento de hoje para quem não tem conta (as páginas tratam isso).
 */
(function () {
  'use strict';
  if (window.firebase && window.firebase.__hostinger) return;

  function api(corpo) {
    return fetch('/api/vp-docs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var e = new Error(j.error || ('Erro ' + r.status)); e.code = r.status === 403 ? 'permission-denied' : 'unavailable'; throw e; }
        return j;
      });
    });
  }

  function limpar(v) {
    if (v instanceof Date) return v.toISOString();
    if (Array.isArray(v)) return v.map(limpar);
    if (v && typeof v === 'object') { var o = {}; Object.keys(v).forEach(function (k) { if (v[k] !== undefined) o[k] = limpar(v[k]); }); return o; }
    return v;
  }

  function DocSnap(ref, dados) {
    this.ref = ref; this.id = ref.id; this.exists = !!dados; this._d = dados || null;
  }
  DocSnap.prototype.data = function () { return this._d ? JSON.parse(JSON.stringify(this._d)) : undefined; };
  DocSnap.prototype.get = function (c) { return this._d ? this._d[c] : undefined; };

  function QuerySnap(docs) { this.docs = docs; this.size = docs.length; this.empty = !docs.length; }
  QuerySnap.prototype.forEach = function (fn) { this.docs.forEach(fn); };
  QuerySnap.prototype.docChanges = function () { return []; };

  function poll(fn, cb, erro) {
    var vivo = true;
    function rodar() {
      if (!vivo) return;
      fn().then(function (s) { if (vivo) cb(s); }, function (e) { if (vivo && erro) erro(e); });
    }
    rodar();
    var t = setInterval(rodar, 15000);
    return function () { vivo = false; clearInterval(t); };
  }

  function autoId() {
    var c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', s = '';
    var a = new Uint8Array(20); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach(function (_, i) { a[i] = Math.random() * 256; });
    for (var i = 0; i < 20; i++) s += c[a[i] % c.length];
    return s;
  }

  function DocRef(caminho) {
    this.path = caminho; var p = caminho.split('/'); this.id = p[p.length - 1];
  }
  DocRef.prototype.collection = function (n) { return new Query(this.path + '/' + n); };
  DocRef.prototype.get = function () { var self = this; return api({ op: 'get', path: this.path }).then(function (j) { return new DocSnap(self, j.exists ? j.data : null); }); };
  DocRef.prototype.set = function (d, o) { return api({ op: 'set', path: this.path, data: limpar(d), merge: !!(o && o.merge) }).then(function () {}); };
  DocRef.prototype.update = function (d) { return api({ op: 'update', path: this.path, data: limpar(d) }).then(function () {}); };
  DocRef.prototype.delete = function () { return Promise.resolve(); };
  DocRef.prototype.onSnapshot = function (cb, erro) { var self = this; return poll(function () { return self.get(); }, cb, erro); };

  function Query(caminho, filtros) {
    this.path = caminho; this.id = caminho.split('/').pop(); this._f = filtros || [];
  }
  Query.prototype.doc = function (id) { return new DocRef(this.path + '/' + (id || autoId())); };
  Query.prototype.add = function (d) { var self = this; return api({ op: 'add', path: this.path, data: limpar(d) }).then(function (j) { return new DocRef(self.path + '/' + j.id); }); };
  Query.prototype.where = function (c, op, v) { return new Query(this.path, this._f.concat([[c, op, v]])); };
  Query.prototype.orderBy = function () { return this; };
  Query.prototype.limit = function () { return this; };
  Query.prototype.startAfter = function () { return this; };
  Query.prototype.get = function () {
    var self = this;
    return api({ op: 'list', path: this.path, where: this._f }).then(function (j) {
      return new QuerySnap((j.docs || []).map(function (d) { return new DocSnap(new DocRef(self.path + '/' + d.id), d.data); }));
    });
  };
  Query.prototype.onSnapshot = function (cb, erro) { var self = this; return poll(function () { return self.get(); }, cb, erro); };

  var bancoUnico = null;
  function firestore() {
    if (!bancoUnico) {
      bancoUnico = {
        collection: function (n) { return new Query(n); },
        doc: function (c) { return new DocRef(c); },
        settings: function () {},
        enablePersistence: function () { return Promise.resolve(); },
        batch: function () {
          var ops = [];
          return {
            set: function (r, d, o) { ops.push(function () { return r.set(d, o); }); return this; },
            update: function (r, d) { ops.push(function () { return r.update(d); }); return this; },
            delete: function () { return this; },
            commit: function () { return Promise.all(ops.map(function (f) { return f(); })); },
          };
        },
      };
    }
    return bancoUnico;
  }
  firestore.FieldValue = {
    serverTimestamp: function () { return { __fv: 'ts' }; },
    increment: function (n) { return { __fv: 'inc', n: n }; },
    arrayUnion: function () { return { __fv: 'union', v: [].slice.call(arguments) }; },
    arrayRemove: function () { return { __fv: 'remove', v: [].slice.call(arguments) }; },
    delete: function () { return { __fv: 'del' }; },
  };
  firestore.Timestamp = { now: function () { var d = new Date(); return { toDate: function () { return d; }, toMillis: function () { return +d; } }; }, fromDate: function (d) { return { toDate: function () { return d; }, toMillis: function () { return +d; } }; } };

  var authUnico = null;
  function auth() {
    if (!authUnico) {
      var semConta = function () { var e = new Error('Login de equipe ainda não disponível nesta hospedagem.'); e.code = 'auth/operation-not-allowed'; return Promise.reject(e); };
      authUnico = {
        currentUser: null,
        onAuthStateChanged: function (cb) { var t = setTimeout(function () { try { cb(null); } catch (e) { console.error(e); } }, 0); return function () { clearTimeout(t); }; },
        signInWithEmailAndPassword: semConta,
        createUserWithEmailAndPassword: semConta,
        sendPasswordResetEmail: semConta,
        signOut: function () { return Promise.resolve(); },
        setPersistence: function () { return Promise.resolve(); },
      };
    }
    return authUnico;
  }
  auth.Auth = { Persistence: { LOCAL: 'local', SESSION: 'session', NONE: 'none' } };
  auth.GoogleAuthProvider = function () {};

  var apps = [];
  window.firebase = {
    __hostinger: true,
    SDK_VERSION: 'hostinger',
    apps: apps,
    initializeApp: function (cfg) { var a = { name: '[DEFAULT]', options: cfg || {} }; apps.push(a); return a; },
    app: function () { return apps[0]; },
    firestore: firestore,
    auth: auth,
  };
})();
