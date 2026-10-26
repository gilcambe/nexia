'use strict';
/**
 * src/middleware/rateLimiter.js — Rate limiter usando express-rate-limit
 * 10 requisições/10s por IP ou 10 mensagens/10s por conta autenticada,
 * bloqueando por 1 min após excesso.
 */
const rateLimit = require('express-rate-limit');
const rateLimitConfig = require('../config/rateLimit');

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

const globalLimiter = rateLimit({
  windowMs: rateLimitConfig.windowMs,
  max: rateLimitConfig.max,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || '127.0.0.1',
  handler: (req, res) => {
    const chave = req.ip || '127.0.0.1';
    bloquear(chave);
    res.set('Retry-After', Math.ceil(rateLimitConfig.blockDurationMs / 1000));
    res.status(429).json(rateLimitConfig.message);
  }
});

const authLimiter = rateLimit({
  windowMs: rateLimitConfig.windowMs,
  max: rateLimitConfig.max,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.usuario && req.usuario.id) ? req.usuario.id : (req.user && req.user.id ? req.user.id : (req.ip || '127.0.0.1')),
  handler: (req, res) => {
    const chave = (req.usuario && req.usuario.id) ? req.usuario.id : (req.user && req.user.id ? req.user.id : (req.ip || '127.0.0.1'));
    bloquear(chave);
    res.set('Retry-After', Math.ceil(rateLimitConfig.blockDurationMs / 1000));
    res.status(429).json(rateLimitConfig.message);
  }
});

const rateLimiter = (req, res, next) => {
  const chave = (req.usuario && req.usuario.id) ? req.usuario.id : (req.user && req.user.id ? req.user.id : (req.ip || '127.0.0.1'));

  if (estaBloqueada(chave)) {
    const restante = Math.ceil((bloqueios.get(chave) - Date.now()) / 1000);
    res.set('Retry-After', restante > 0 ? restante : 1);
    return res.status(429).json(rateLimitConfig.message);
  }

  if ((req.usuario && req.usuario.id) || (req.user && req.user.id)) {
    return authLimiter(req, res, next);
  } else {
    return globalLimiter(req, res, next);
  }
};

module.exports = rateLimiter;
