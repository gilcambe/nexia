const rateLimit = require('express-rate-limit');
const rateLimitConfig = require('../config/rateLimit');

// Rate limit geral: 10 requisições por 10 segundos por IP
const globalLimiter = rateLimit({
  windowMs: rateLimitConfig.windowMs,
  max: rateLimitConfig.max,
  standard: rateLimitConfig.standard,
  message: rateLimitConfig.message,
  handler: (req, res) => {
    res.set('Retry-After', Math.ceil(rateLimitConfig.blockDurationMs / 1000));
    res.status(429).json(rateLimitConfig.message);
  }
});

// Rate limit por conta (autenticado): 10 mensagens por 10 segundos
const authLimiter = rateLimit({
  windowMs: rateLimitConfig.windowMs,
  max: rateLimitConfig.max,
  standard: rateLimitConfig.standard,
  message: rateLimitConfig.message,
  handler: (req, res) => {
    res.set('Retry-After', Math.ceil(rateLimitConfig.blockDurationMs / 1000));
    res.status(429).json(rateLimitConfig.message);
  }
});

// Middleware que aplica o rate limit correto baseado em auth status
const rateLimiter = (req, res, next) => {
  // Se usuário estiver autenticado (req.user disponível), usa o limiter de conta
  if (req.user) {
    authLimiter(req, res, next);
  } else {
    globalLimiter(req, res, next);
  }
};

module.exports = rateLimiter;