'use strict';

const health = require('./health');

module.exports = function (app) {
  app.get('/api/prumo', (req, res) => {
    const result = health(req, res);
    return res.json(result);
  });
};

