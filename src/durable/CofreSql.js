'use strict';
// #2188: banco extra do Vault dentro do próprio Worker (Durable Object com SQLite, plano grátis).
// Fala o mesmo formato da API REST do D1 ({ sql, params } ou { batch }), então o driver do D1
// (lib/firebase-lite/d1-backend.js) serve igual. Cota própria, separada do D1 da conta.

class CofreSql {
  constructor(state) {
    this.sql = state?.storage?.sql || null;
  }

  async fetch(request) {
    const resposta = (status, corpo) => new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });
    if (!this.sql) return resposta(500, { success: false, errors: [{ message: 'CofreSql: storage.sql indisponível.' }] });
    try {
      const b = await request.json();
      const result = (b.batch || [b]).map(st => ({ results: this.sql.exec(st.sql, ...(st.params || [])).toArray() }));
      return resposta(200, { success: true, result });
    } catch (e) {
      const message = String((e && e.message) || e);
      return resposta(/exceeded|limit/i.test(message) ? 429 : 500, { success: false, errors: [{ message }] });
    }
  }
}

module.exports = { CofreSql };
