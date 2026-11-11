'use strict';

const health = require('./health');

module.exports = function (app) {
  // GET /api/prumo?acao=saude -> health.js
  app.get('/api/prumo', health);
};
