'use strict';
// Link na bio do Instagram: /conheca (página) → botão "Teste grátis" → GET /api/conheca?r=<rede>
// Conta o clique do dia (sem guardar nada de quem clicou) e manda para o app com UTM. Público, nunca falha para o visitante.

const APP = 'https://bodycoach.kernex.com.br/';
const REDES = new Set(['bio', 'instagram', 'story', 'reel', 'threads', 'pinterest', 'bluesky', 'facebook']);

function destino(rede) {
  const u = new URL(APP);
  u.searchParams.set('utm_source', rede);
  u.searchParams.set('utm_medium', 'social');
  u.searchParams.set('utm_campaign', 'divulga');
  return u.toString();
}

const dia = (agora = new Date()) => new Date(agora.getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10);

function createHandler(deps = {}) {
  const getDb = deps.getDb || (() => require('./firebase-init'));
  return async (event) => {
    const method = String(event.httpMethod || '').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') return { statusCode: 405, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    const q = event.queryStringParameters || {};
    const rede = REDES.has(String(q.r || '').toLowerCase()) ? String(q.r).toLowerCase() : 'bio';
    try {
      const { admin, db } = getDb();
      if (db && admin) {
        const inc = admin.firestore.FieldValue.increment(1);
        await db.collection('divulga_cliques').doc(dia(deps.agora && deps.agora())).set({ total: inc, redes: { [rede]: inc } }, { merge: true });
      }
    } catch { /* contador fora do ar: o visitante segue para o app do mesmo jeito */ }
    return { statusCode: 302, headers: { Location: destino(rede), 'Cache-Control': 'no-store' }, body: '' };
  };
}

exports.handler = createHandler();
exports.createHandler = createHandler;
exports.destino = destino;
exports.dia = dia;
