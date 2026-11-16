'use strict';

const health = require('./health');

module.exports = function (app) {
  app.get('/api/prumo', (req, res) => {
    return health(req, res);
  });
};

