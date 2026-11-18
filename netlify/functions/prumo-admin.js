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
    // Sem autenticação válida, 401. Autenticado, mas sem role 'master', 403.
    if (!auth || !auth.ok) {
      return { statusCode: 401, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, error: 'Não autenticado.' }) };
    }
    if (auth.role !== 'master') {
      return { statusCode: 403, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, error: 'Só o administrador da KERNEX' }) };
    }
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, uid: auth.uid, email: auth.email, role: auth.role }) };
  };
}

// Handler exportado no formato Netlify: exports.handler(event, context).
exports.handler = createHandler();
exports.createHandler = createHandler;
exports.COLLECTION = COLLECTION;
