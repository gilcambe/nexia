'use strict';

const crypto = require('crypto');

/**
 * Valida token Firebase e retorna o UID do cliente.
 * @param {string} token - Token JWT do Firebase
 * @param {string} secret - Chave secreta para verificação de assinatura
 * @returns {Object} - { uid: string } ou erro
 * @throws {Error} - 401 se token inválido, 403 se UID não corresponder
 */
function validateFirebaseToken(token, secret) {
  if (!token) {
    throw new Error('401: Token não fornecido');
  }

  // Formato básico de token JWT: header.payload.signature
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('401: Token inválido');
  }

  try {
    // Decodifica o header e payload
    const header = JSON.parse(Buffer.from(parts[0], 'base64').toString('utf-8'));
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
    
    // Verifica se tem uid (Firebase usa 'sub' ou 'uid')
    const uid = payload.uid || payload.sub;
    if (!uid) {
      throw new Error('401: Token sem UID');
    }
    
    // Verifica se o token não expirou
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      throw new Error('401: Token expirado');
    }
    
    // Verifica se o token não é muito antigo (opcional, mas recomendado)
    if (payload.iat && payload.iat > now + 3600) {
      throw new Error('401: Token emitido no futuro');
    }
    
    // Verifica se o algoritmo é HMAC-SHA256 (padrão Firebase)
    if (header.alg !== 'HS256') {
      throw new Error('401: Algoritmo de assinatura inválido');
    }
    
    // Verifica a assinatura
    const signature = parts[2];
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${parts[0]}.${parts[1]}`)
      .digest('base64url');
      
    if (signature !== expectedSignature) {
      throw new Error('401: Assinatura inválida');
    }
    
    return { uid };
  } catch (e) {
    throw new Error('401: Token inválido: ' + e.message);
  }
}

/**
 * Middleware para validar token e retornar UID
 * @param {Request} request - Requisição HTTP
 * @returns {Object} - { uid: string } ou lança erro
 */
async function validateClientToken(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('401: Token não fornecido');
  }

  const token = authHeader.substring(7); // Remove 'Bearer '
  return validateFirebaseToken(token);
}

// Extrai o uid do caminho /api/cortex-cliente/<uid>/...
function uidDoCaminho(pathname) {
  const m = String(pathname || '').match(/^\/api\/cortex-cliente\/([^/]+)/);
  return m ? m[1] : null;
}

// Middleware: valida o token Firebase e confere que o uid do caminho é o dono do token.
// Retorna { uid } ou lança erro 401 (sem token/inválido) ou 403 (uid não confere).
async function validarAcessoCliente(request, pathname) {
  const { uid } = await validateClientToken(request);
  const uidCaminho = uidDoCaminho(pathname);
  if (!uidCaminho) throw new Error('403: UID do cliente não informado no caminho');
  if (uidCaminho !== uid) throw new Error('403: Acesso negado aos dados deste cliente');
  return { uid };
}

module.exports = {
  validateFirebaseToken,
  validateClientToken,
  uidDoCaminho,
  validarAcessoCliente
};
