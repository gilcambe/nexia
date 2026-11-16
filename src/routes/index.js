'use strict';

const health = require('./health');

// Rotas da API. Cada linha liga um caminho ao handler que responde.

module.exports = function (app) {
  app.get('/api/prumo', (req, res) => {
    // Ajuste: verifique se o handler `health` está correto
    return health(req, res);
  });
};

