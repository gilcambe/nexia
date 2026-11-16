'use strict';

const health = require('./health');

// Rotas da API. Cada linha liga um caminho ao handler que responde.

module.exports = function (app) {
  // GET /api/prumo?acao=saude -> health.js (retorna { ok: true, hora: <ISO> })
  app.get('/api/prumo', async (req, res) => {
    const acao = req.query && req.query.acao;
    if (!acao) {
      return res.status(400).json({ ok: false, erro: 'acao obrigatoria' });
    }
    const result = health(req, res);
    return res.json(result);
  });
};

