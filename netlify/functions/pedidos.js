'use strict';
const { agir } = require('./central/pedidos-acoes');

// Cortex no celular: o dono manda pedidos ao Cortex e vê todo o histórico, sem precisar da Claude.
//   GET  /api/pedidos?q=&estado=todos|abertos|travados|feitos&pagina=1   lista
//   GET  /api/pedidos?n=123                                              um pedido com conversa e PRs
//   POST /api/pedidos {acao:'pedir', texto} | {acao:'comentar', n, texto} | {acao:'tentar', n}
//                     {acao:'cancelar', n} | {acao:'reabrir', n} | {acao:'juntar', pr}

function createHandler(deps = {}) {
  const getMw = deps.getMw || (() => require('./middleware'));
  const getPedidos = deps.getPedidos || (() => {
    const p = require('./central/pedidos-gh').criarPedidos();
    return { ...p, detalhe: require('./central/pedidos-detalhe').criarDetalhe(p.gh) };
  });

  return async (event) => {
    const method = String(event.httpMethod || '').toUpperCase();
    const cors = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' };
    const res = (statusCode, body) => ({ statusCode, headers: cors, body: JSON.stringify(body) });
    if (method === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
    if (method !== 'GET' && method !== 'POST') return res(405, { error: 'Method Not Allowed' });

    const auth = await getMw().verifyBearerToken(event).catch(() => ({ ok: false }));
    if (!auth.ok || auth.role !== 'master') return res(403, { error: 'Só o dono da NEXIA abre o Cortex.' });

    const p = getPedidos();
    if (!p.temToken) return res(500, { error: 'Falta o token do GitHub (NEXIA_JOBS_TOKEN) no servidor.' });
    try {
      if (method === 'GET') {
        const qs = event.queryStringParameters || {};
        if (qs.deploy) return res(200, await require('./central/pedidos-publicar').situacao(p.gh));
        if (qs.n) return res(200, await p.detalhe(qs.n));
        return res(200, await p.lista({ q: qs.q, estado: qs.estado, pagina: qs.pagina }));
      }
      let b = {};
      try { b = JSON.parse(event.body || '{}') || {}; } catch { return res(400, { error: 'Pedido inválido.' }); }
      const x = await agir(p, b, auth.email || 'dono');
      return res(x.status, x.corpo);
    } catch (e) {
      return res(502, { error: 'GitHub: ' + e.message });
    }
  };
}

exports.createHandler = createHandler;
exports.handler = createHandler();
