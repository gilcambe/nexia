'use strict';

const health = require('./health'); // handler health

// Rotas da API. Cada linha liga um caminho ao handler que responde.

module.exports = function (app) {
    // Rota de saúde: GET /api/prumo?acao=saude
  app.get('/api/prumo', (req, res) => Promise.resolve(health(req, res)).catch((err) => {
    console.error('[routes] erro em /api/prumo:', err?.message || err);
    if (!res.headersSent) {
      res.status(500).json({ ok: false, erro: 'Erro interno na verificação de saúde.' });
    }
  }));
};
// health route registration
