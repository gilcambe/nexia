'use strict';

/**
 * Extrai o UID do usuário a partir do token Bearer no header Authorization.
 * Retorna { uid }. Lança erro com status 401 quando o token está ausente.
 *
 * @param {Request} request
 * @returns {{ uid: string }}
 */
function getUidFromRequest(request) {
  const auth = request.headers.get('authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(auth);
  if (!match) {
    const err = new Error('Token de autenticação ausente.');
    err.status = 401;
    throw err;
  }
  const token = match[1];
  // O uid vem do próprio token (em produção, validar com Firebase Admin SDK).
  return { uid: token };
}

module.exports = { getUidFromRequest };
