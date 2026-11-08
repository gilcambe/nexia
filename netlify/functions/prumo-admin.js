'use strict';

// NEXIA Prumo Admin — painel de administração do Prumo (restrito a master).
// Verifica se o usuário autenticado via Bearer token possui a role "master".
// Caso contrário, retorna 403 Forbidden.

function createHandler(deps = {}) {
  const getMw = deps.getMw || (() => require('./middleware'));

  return async (event) => {
    const headers = event.headers || {};
    const cors = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    const res = (statusCode, body) => ({
      statusCode,
      headers: cors,
      body: JSON.stringify(body),
    });

    const method = String(event.httpMethod || '').toUpperCase();
    if (method === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };

    const auth = headers.authorization ? await getMw().verifyBearerToken(event) : { ok: false };
    if (!auth.ok || auth.role !== 'master') {
      return res(403, { error: 'Acesso restrito a administradores master.' });
    }

    return res(200, { ok: true, message: 'Bem-vindo ao painel admin do Prumo.' });
  };
}

exports.handler = createHandler();
exports.createHandler = createHandler;
