'use strict';

// NEXIA Prumo Admin — painel de administração do Prumo (restrito a master).
// Segue a estrutura padrão (semelhante a agenda.js), verificando a role "master"
// e retornando 403 se o usuário não for master.

function createHandler(deps = {}) {
  const getMw = deps.getMw || (() => require('./middleware'));
  const { verifyBearerToken } = getMw();
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
    const res = (statusCode, body) => ({
      statusCode,
      headers: cors,
      body: JSON.stringify(body),
    });

    if (method === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
    if (method !== 'GET' && method !== 'POST') return res(405, { error: 'Method Not Allowed' });

    let body = {};
    if (method === 'POST' && event.body) {
      try {
        body = JSON.parse(event.body);
      } catch {
        return res(400, { error: 'Pedido inválido.' });
      }
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) body = {};

    // Autenticação (Bearer): sem token válido é 401; logado, mas sem role "master", é 403.
    const auth = await verifyBearerToken(event);
    if (!auth || !auth.ok) {
      return res(401, { error: 'Autenticação necessária.' });
    }
    const role = String(auth.role || '').trim().toLowerCase();
    if (role !== 'master') {
      return res(403, { error: 'Acesso restrito a master.' });
    }

    return res(200, { ok: true, message: 'Painel Prumo Admin.', timestamp: now() });
  };
}

exports.handler = createHandler();
exports.createHandler = createHandler;
