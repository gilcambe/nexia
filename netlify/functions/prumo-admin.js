'use strict';

// Kernex Finance (Prumo Admin) — API administrativa (/api/prumo-admin).
// Só o administrador da KERNEX (master) entra.
// Nunca grava em disco (sem fs.writeFileSync / require dinâmico).

function createHandler(deps = {}) {
  const getDb = deps.getDb || (() => require('./firebase-init').db);
  const getMw = deps.getMw || (() => require('./middleware'));
  const now = deps.now || (() => Date.now());

  return async (event) => {
    const method = String(event.httpMethod || '').toUpperCase();
    const headers = event.headers || {};
    const cors = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    const res = (statusCode, body) => ({ statusCode, headers: cors, body: JSON.stringify(body) });

    if (method === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
    if (method !== 'GET' && method !== 'POST') return res(405, { error: 'Method Not Allowed' });

    const auth = headers.authorization ? await getMw().verifyBearerToken(event).catch(() => ({ ok: false })) : { ok: false };
    if (!auth.ok) return res(401, { error: 'Entre com sua conta.' });
    if (auth.role !== 'master') return res(403, { error: 'Só o administrador da KERNEX entra como master.' });

    let body = {};
    if (method === 'POST' && event.body) {
      try {
        body = JSON.parse(event.body);
      } catch {
        return res(400, { error: 'Pedido inválido.' });
      }
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) body = {};

    const q = event.queryStringParameters || {};

    if (method === 'GET') {
      const parte = q.parte || 'status';
      if (parte === 'status') {
        return res(200, {
          ok: true,
          admin: true,
          servico: 'prumo-admin',
          em: new Date(now()).toISOString(),
        });
      }
      return res(200, { ok: true, parte });
    }

    if (method === 'POST') {
      const acao = body.acao || '';
      if (!acao) return res(400, { error: 'Ação não informada.' });

      // Suporte para ações administrativas do Prumo
      return res(200, { ok: true, acao, recebido_em: new Date(now()).toISOString() });
    }

    return res(400, { error: 'Ação desconhecida.' });
  };
}

exports.handler = createHandler();
exports.createHandler = createHandler;
