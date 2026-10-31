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
            
            // Criar tabela de contador de uso diário
            this.sql.exec(`CREATE TABLE IF NOT EXISTS cofresql_usage (
              banco TEXT NOT NULL,
              data TEXT NOT NULL,
              leituras INTEGER NOT NULL DEFAULT 0,
              escritas INTEGER NOT NULL DEFAULT 0,
              PRIMARY KEY (banco, data)
            );`);
          } catch {}
        }
    }

  _dispararAvisoSentinel(bancoKey, leituras, escritas) {
    try {
      const isFs = /firestore/i.test(bancoKey);
      const maxL = isFs ? 50000 : (/cofresql/i.test(bancoKey) ? 50000000 : 5000000);
      const maxE = isFs ? 20000 : (/cofresql/i.test(bancoKey) ? 10000000 : 100000);
      const pctL = Number(((leituras / maxL) * 100).toFixed(1));
      const pctE = Number(((escritas / maxE) * 100).toFixed(1));
      const alerta = {
        tipo: 'sentinel',
        banco: bancoKey,
        leituras,
        escritas,
        limiteLeituras: maxL,
        limiteEscritas: maxE,
        percentualLeituras: pctL,
        percentualEscritas: pctE,
        timestamp: new Date().toISOString(),
        acao: 'alternar_tráfego_preventivo_cofresql',
        passoAPasso: [
          `1. Banco ${bancoKey} atingiu o limite preventivo de 70% (leituras: ${pctL}%, escritas: ${pctE}%).`,
          `2. O Vault ativou automaticamente o rodízio para o próximo banco na ordem B -> C -> D1 -> CofreSql.`,
          `3. Verifique o consumo na Central e valide a integridade dos dados.`
        ]
      };
      console.warn(`[SENTINEL ALERT] [sentinel] Banco ${bancoKey} atingiu 70% da cota! Leituras: ${leituras}/${maxL} (${pctL}%), Escritas: ${escritas}/${maxE} (${pctE}%).`);
      console.log('[SENTINEL CENTRAL ALARM] [sentinel]', JSON.stringify(alerta));
      
      // Propagar métricas e sinal de quase cheio para o VazaoController / Worker via fetch local se disponível
      if (typeof fetch === 'function') {
        fetch('http://localhost:8787/marcar-cheio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ banco: bancoKey, leituras, escritas, limiteLeituras: maxL, limiteEscritas: maxE, percentualLeituras: pctL, percentualEscritas: pctE, status: 'quase cheio' })
        }).catch(e => console.error('[CofreSql VazaoController] Erro ao notificar Worker:', e));
      }
    } catch (e) {
      console.error('[CofreSql] Erro ao disparar aviso sentinel:', e);
    }
  }

  _checkLimits(banco, leituras, escritas) {
    const isFs = /firestore/i.test(banco);
    const maxL = isFs ? 50000 : (/cofresql/i.test(banco) ? 50000000 : 5000000);
    const maxE = isFs ? 20000 : (/cofresql/i.test(banco) ? 10000000 : 100000);
    if (leituras >= maxL * 0.7 || escritas >= maxE * 0.7) {
      return true;
    }
    return false;
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
            this.sql.exec(`INSERT INTO vazaosql (banco, data, leituras, escritas) VALUES (?, ?, ?, ?)
              ON CONFLICT(banco) DO UPDATE SET leituras = CASE WHEN data = ? THEN leituras + ? ELSE ? END, escritas = CASE WHEN data = ? THEN escritas + ? ELSE ? END, data = ?`,
              bancoKey, data, leituras, escritas, data, leituras, leituras, data, escritas, escritas, data);
            
            // Registrar uso diário na tabela de contador
            this.sql.exec(`INSERT INTO cofresql_usage (banco, data, leituras, escritas) VALUES (?, ?, ?, ?)
              ON CONFLICT(banco, data) DO UPDATE SET leituras = leituras + ?, escritas = escritas + ?`,
              bancoKey, data, leituras, escritas, leituras, escritas);
            
            const rows = this.sql.exec(`SELECT leituras, escritas FROM vazaosql WHERE banco = ?`, bancoKey);
            const row = rows.toArray ? rows.toArray()[0] : rows[0];
            if (row && this._checkLimits(bancoKey, row.leituras, row.escritas)) {
              this._dispararAvisoSentinel(bancoKey, row.leituras, row.escritas);
            }
          }
          const rowsNow = this.sql.exec(`SELECT leituras, escritas FROM vazaosql WHERE banco = ?`, bancoKey);
          const rowNow = rowsNow.toArray ? rowsNow.toArray()[0] : rowsNow[0] || { leituras: 0, escritas: 0 };
          const quaseCheio = this._checkLimits(bancoKey, rowNow.leituras, rowNow.escritas);
          return resposta(200, { success: true, quaseCheio, leituras: rowNow.leituras, escritas: rowNow.escritas });
        }
        if (path.includes('/vazao-get') && request.method === 'GET') {
          const rows = this.sql.exec(`SELECT banco, data, leituras, escritas FROM vazaosql`).toArray();
          const uso = {};
          for (const r of rows) {
            uso[r.banco] = { data: r.data, leituras: r.leituras, escritas: r.escritas };
          }
          return resposta(200, { success: true, uso });
        }
        
        if (path.includes('/usage') && request.method === 'GET') {
          const rows = this.sql.exec(`SELECT banco, data, leituras, escritas FROM cofresql_usage`).toArray();
          const uso = {};
          for (const r of rows) {
            if (!uso[r.banco]) uso[r.banco] = { data: r.data, leituras: 0, escritas: 0 };
            uso[r.banco].leituras += r.leituras;
            uso[r.banco].escritas += r.escritas;
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
