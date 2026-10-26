import jwt from 'jsonwebtoken';

// Configuração para modo teste
const isTestMode = process.env.NODE_ENV === 'test';
const JWT_SECRET = isTestMode ? 'test-secret-key-for-jwt-signing' : process.env.JWT_SECRET;

/**
 * Verifica e decoda um token JWT
 * @param {string} token - Token JWT
 * @returns {Object} - Dados decodados do token
 * @throws {Error} - Se o token for inválido
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Token inválido');
  }
}

/**
 * Gera um token JWT para teste
 * @param {string} uid - ID do usuário
 * @returns {string} - Token JWT
 */
export function generateTestToken(uid) {
  if (!isTestMode) {
    throw new Error('Este método só pode ser usado em modo teste');
  }
  
  return jwt.sign(
    { uid, type: 'access', exp: Math.floor(Date.now() / 1000) + (60 * 60) },
    JWT_SECRET
  );
}

/**
 * Middleware para autenticação de requests
 * @param {Object} req - Objeto de requisição
 * @param {Object} res - Objeto de resposta
 * @param {Function} next - Função next
 */
export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const token = authHeader.substring(7);
  
  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    return next();
  } catch (error) {
    return res.status(403).json({ error: 'Forbidden' });
  }
}