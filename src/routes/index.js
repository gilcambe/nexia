'use strict';

const health = require('./health');

module.exports = function (app) {
  // GET /api/prumo?acao=saude -> health.js (retorna { ok: true, hora: <ISO> })
  app.get('/api/prumo', health);
};
