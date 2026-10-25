'use strict';

const express = require('express');
const cors = require('cors');

// Importar rotas
const automationsRoutes = require('./routes/automations.js');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Registrar rotas
app.use('/api/automations', automationsRoutes);

// Rota de health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Middleware para tratamento de erros
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    error: 'Erro interno do servidor', 
    details: process.env.NODE_ENV === 'development' ? err.message : undefined 
  });
});

// Middleware para rotas não encontradas
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    error: 'Rota não encontrada' 
  });
});

module.exports = app;