'use strict';

const health = require('./health'); // health route

module.exports = function (app) {
  app.get('/api/prumo', health); // health route
};
