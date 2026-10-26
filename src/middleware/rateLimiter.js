const rateLimit = require('express-rate-limit');
const rateLimitConfig = require('../config/rateLimit');

// Armazena bloqueios temporários: { chave: timestampExpiracao }
const bloqueios = new Map();

function estaBloqueada(chave) {
  const expiraEm = bloqueios.get(chave);
  if (!expiraEm) return false;
  if (Date.now() < expiraEm) return true;
  bloqueios.delete(chave);
  return false;
}

function bloquear(chave) {
  bloqueios.set(chave, Date.now() + rateLimitConfig.blockDurationMs);
}

// Rate limit geral: 10 requisições por 10 segundos por IP (anônimos)
const globalLimiter = rateLimit({
  windowMs: rateLimitConfig.windowMs,
  max: rateLimitConfig.max,
  keyGenerator: (req) => req.ip,
  message: rateLimitConfig.message,
  handler: (req, res) => {
    bloquear(req.ip);
    res.set('Retry-After', Math.ceil(rateLimitConfig.blockDurationMs / 1000));
    res.status(429).json(rateLimitConfig.message);
  }
});

// Rate limit por conta (autenticado): 10 mensagens por 10 segundos
const authLimiter = rateLimit({
  windowMs: rateLimitConfig.windowMs,
  max: rateLimitConfig.max,
  keyGenerator: (req) => (req.usuario && req.usuario.id) ? req.usuario.id : req.ip,
  message: rateLimitConfig.message,
  handler: (req, res) => {
    const chave = (req.usuario && req.usuario.id) ? req.usuario.id : req.ip;
    bloquear(chave);
    res.set('Retry-After', Math.ceil(rateLimitConfig.blockDurationMs / 1000));
    res.status(429).json(rateLimitConfig.message);
  }
});

// Middleware que aplica o rate limit correto baseado em auth status
const rateLimiter = (req, res, next) => {
  const chave = (req.usuario && req.usuario.id) ? req.usuario.id : req.ip;

  if (estaBloqueada(chave)) {
    const restante = Math.ceil((bloqueios.get(chave) - Date.now()) / 1000);
    res.set('Retry-After', restante > 0 ? restante : 1);
    return res.status(429).json(rateLimitConfig.message);
  }

  if (req.usuario && req.usuario.id) {
    authLimiter(req, res, next);
  } else {
    globalLimiter(req, res, next);
  }
};

module.exports = rateLimiter;