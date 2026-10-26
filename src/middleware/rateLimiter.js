const rateLimit = require('express-rate-limit');

// Rate limit geral: 10 requisições por 10 segundos por IP
const globalLimiter = rateLimit({
  windowMs: 10 * 1000, // 10 segundos
  max: 10, // máximo 10 requisições
  standard: true,
  message: { error: 'Muitas requisições. Tente novamente em 10 segundos.' },
  handler: (req, res) => {
    res.status(429).json({ error: 'Muitas requisições. Tente novamente em 10 segundos.' });
  }
});

// Rate limit por conta (autenticado): 10 mensagens por 10 segundos
const authLimiter = rateLimit({
  windowMs: 10 * 1000, // 10 segundos
  max: 10, // máximo 10 mensagens
  standard: true,
  message: { error: 'Limite de mensagens atingido. Tente novamente em 10 segundos.' },
  handler: (req, res) => {
    res.status(429).json({ error: 'Limite de mensagens atingido. Tente novamente em 10 segundos.' });
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