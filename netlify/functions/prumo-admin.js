'use strict';

// Kernex Finance Admin (/api/prumo-admin).
// Estrutura baseada no padrão de agenda.js.
// Só o master da NEXIA tem acesso (role 'master').

const COLLECTION = 'prumo_usuarios';

function createHandler(deps = {}) {
  const getMw = deps.getMw || (() => require('./middleware'));
  return async (event) => {
    const mw = getMw();
    if (!mw || typeof mw.verifyBearerToken !== 'function') {
      return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, error: 'Middleware indisponível.' }) };
    }
    const auth = await mw.verifyBearerToken(event);
    if (!auth || !auth.ok || auth.role !== 'master') {
      return { statusCode: 403, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, error: 'Acesso negado: usuário não é master.' }) };
    }
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, uid: auth.uid, email: auth.email, role: auth.role }) };
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports.handler = createHandler();
  module.exports.createHandler = createHandler;
  module.exports.COLLECTION = COLLECTION;
}

function createHandler(deps = {}) {
  const getDb = deps.getDb || (() => require('./firebase-init').db);
  const getMw = deps.getMw || (() => require('./middleware'));

  return async (event) => {
    const method = String(event.httpMethod || '').toUpperCase();
    const headers = event.headers || {};
    const cors = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' };
    const res = (statusCode, body) => ({ statusCode, headers: cors, body: JSON.stringify(body) });

    if (method === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };

    // Checagem de autenticação: obrigatória para todas as ações
    const auth = headers.authorization ? await getMw().verifyBearerToken(event) : { ok: false };
    if (!auth.ok || auth.role !== 'master') {
      return res(403, { error: 'Acesso negado: apenas administradores master podem acessar.' });
    }

    if (method !== 'GET' && method !== 'POST') return res(405, { error: 'Method Not Allowed' });

    // Lógica para o master...
    return res(200, { ok: true, mensagem: 'Bem-vindo, master.' });
  };
}

exports.handler = createHandler();
exports.createHandler = createHandler;
