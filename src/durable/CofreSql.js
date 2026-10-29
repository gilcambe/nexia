'use strict';
// #2188: banco extra do Vault dentro do próprio Worker (Durable Object com SQLite, plano grátis).
// Fala o mesmo formato da API REST do D1 ({ sql, params } ou { batch }), então o driver do D1
// (lib/firebase-lite/d1-backend.js) serve igual. Cota própria, separada do D1 da conta.

class CofreSql {
  constructor(state) {
      this.sql = state?.storage?.sql || null;
      if (this.sql) {
        try {
          this.sql.exec(`CREATE TABLE IF NOT EXISTS vazaosql (
            banco TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            leituras INTEGER NOT NULL DEFAULT 0,
            escritas INTEGER NOT NULL DEFAULT 0
          );`);
        } catch {}
      }
    }

  async fetch(request) {
    const resposta = (status, corpo) => new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });
    if (!this.sql) return resposta(500, { success: false, errors: [{ message: 'CofreSql: storage.sql indisponível.' }] });
          try {
        const url = new URL(request.url);
        const path = url.pathname;
        if (path.includes('/vazao') && request.method === 'POST') {
          const body = await request.json();
          const { banco, data, leituras = 0, escritas = 0, projectId = '' } = body || {};
          const bancoKey = banco || projectId;
          if (bancoKey && data) {
            // Se mudou de dia, reseta as contagens ou acumula. Aqui acumulamos por banco/data, ou limpamos se for data nova.
            this.sql.exec(`INSERT INTO vazaosql (banco, data, leituras, escritas) VALUES (?, ?, ?, ?)
              ON CONFLICT(banco) DO UPDATE SET leituras = CASE WHEN data = ? THEN leituras + ? ELSE ? END, escritas = CASE WHEN data = ? THEN escritas + ? ELSE ? END, data = ?`,
              bancoKey, data, leituras, escritas, data, leituras, leituras, data, escritas, escritas, data);
          }
          return resposta(200, { success: true });
        }
        if (path.includes('/vazao-get') && request.method === 'GET') {
          const rows = this.sql.exec(`SELECT banco, data, leituras, escritas FROM vazaosql`).toArray();
          const uso = {};
          for (const r of rows) {
            uso[r.banco] = { data: r.data, leituras: r.leituras, escritas: r.escritas };
          }
          return resposta(200, { success: true, uso });
        }
        const b = await request.json();
        const result = (b.batch || [b]).map(st => ({ results: this.sql.exec(st.sql, ...(st.params || [])).toArray() }));
        return resposta(200, { success: true, result });
      } catch (e) {
      const message = String((e && e.message) || e);
      return resposta(/exceeded|limit/i.test(message) ? 429 : 500, { success: false, errors: [{ message }] });
    }
  }
}

// Ponte para o GitHub Actions (jobs fora do Worker): POST /api/cofre-sql com o segredo NEXIA_CRON_SECRET
// no cabeçalho x-nexia-cron. Sem o segredo (ou curto), a rota não existe.
async function pontaCofre(request, env) {
  const secret = String((env && env.NEXIA_CRON_SECRET) || '');
  if (secret.length < 32 || !env.COFRE_SQL) return new Response('Not Found', { status: 404 });
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  const enc = new TextEncoder();
  const a = enc.encode(request.headers.get('x-nexia-cron') || ''), b = enc.encode(secret);
  let dif = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) dif |= (a[i] || 0) ^ b[i];
  if (dif) return new Response('Unauthorized', { status: 401 });
  return env.COFRE_SQL.get(env.COFRE_SQL.idFromName('cofre')).fetch('https://cofre/query', { method: 'POST', body: await request.text() });
}

module.exports = { CofreSql, pontaCofre };
