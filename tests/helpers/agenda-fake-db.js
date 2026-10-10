'use strict';
// Firestore de mentira em memória: só o que a agenda usa (doc/collection/where/get/set/update/delete/batch).
function fakeDb() {
  const docs = new Map();
  let n = 0;
  const snap = (p) => ({ id: p.split('/').pop(), exists: docs.has(p), data: () => (docs.has(p) ? { ...docs.get(p) } : undefined) });
  const err = () => Object.assign(new Error('6 ALREADY_EXISTS: Document already exists'), { code: 6 });
  // Igual ao Firestore de verdade: lista dentro de lista é recusada.
  const semListaDeLista = (v) => {
    if (Array.isArray(v)) { if (v.some(Array.isArray)) throw new Error('3 INVALID_ARGUMENT: Nested arrays are not allowed'); v.forEach(semListaDeLista); }
    else if (v && typeof v === 'object') Object.values(v).forEach(semListaDeLista);
    return v;
  };
  function docRef(p) {
    return {
      id: p.split('/').pop(), path: p,
      collection: (c) => colRef(`${p}/${c}`),
      get: async () => snap(p),
      set: async (d, o) => { semListaDeLista(d); docs.set(p, o && o.merge ? { ...(docs.get(p) || {}), ...d } : { ...d }); },
      create: async (d) => { semListaDeLista(d); if (docs.has(p)) throw err(); docs.set(p, { ...d }); },
      update: async (d) => { semListaDeLista(d); if (!docs.has(p)) throw new Error('5 NOT_FOUND'); docs.set(p, { ...docs.get(p), ...d }); },
      delete: async () => { docs.delete(p); },
    };
  }
  function colRef(p, filtros = []) {
    const filho = k => k.startsWith(p + '/') && !k.slice(p.length + 1).includes('/');
    return {
      doc: (id) => docRef(`${p}/${id || 'auto' + (++n)}`),
      add: async (d) => { const r = docRef(`${p}/auto${++n}`); await r.create(d); return r; },
      where: (f, op, v) => colRef(p, [...filtros, [f, op, v]]),
      get: async () => ({
        docs: [...docs.keys()].filter(filho).map(k => snap(k)).filter(s => filtros.every(([f, op, v]) => {
          const x = s.data()[f];
          return op === '==' ? x === v : op === '>=' ? x >= v : op === '<=' ? x <= v : false;
        })),
      }),
    };
  }
  return {
    docs,
    collection: (c) => colRef(c),
    batch: () => {
      const ops = [];
      return {
        set: (r, d) => { ops.push(() => r.set(d)); },
        create: (r, d) => { ops.push(['c', r, d]); },
        delete: (r) => { ops.push(() => r.delete()); },
        commit: async () => {
          for (const o of ops) if (Array.isArray(o) && docs.has(o[1].path)) throw err(); // tudo ou nada
          for (const o of ops) { if (Array.isArray(o)) await o[1].create(o[2]); else await o(); }
        },
      };
    },
  };
}

module.exports = { fakeDb };
