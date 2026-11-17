'use strict';

const health = require('./health');

module.exports = function (app) {
  // Registrar a rota /api/prumo antes dos handlers Netlify
  app.get('/api/prumo', (req, res) => {
    return health(req, res);
  });
};

