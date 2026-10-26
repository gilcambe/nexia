'use strict';
/**
 * src/app.js — Aplicação Express do NEXIA OS
 */
const express = require('express');
const rateLimiter = require('./middleware/rateLimiter');

const app = express();

app.use(express.json());
app.use(rateLimiter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

module.exports = app;
