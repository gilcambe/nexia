'use strict';

const health = require('./health');

module.exports = function (app) {
  app.get('/api/prumo', health); // health route
};
