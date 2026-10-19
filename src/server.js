const express = require('express');
const PORT = process.env.PORT || 3000;

// Carrega o módulo de monitoramento de saúde com validação de segurança
let startWatcher;
try {
  const healthWatcher = require('./monitoring/healthWatcher');
  if (typeof healthWatcher.startWatcher !== 'function') {
    throw new Error('O módulo healthWatcher não exporta startWatcher como função');
  }
  startWatcher = healthWatcher.startWatcher;
} catch (err) {
  console.error('Falha ao carregar o módulo de monitoramento de saúde:', err.message);
  startWatcher = null;
}

const app = express();

// Middleware de autenticação (Bearer token via variável de ambiente)
const EXPECTED_TOKEN = process.env.NEXIA_API_TOKEN;
function authenticate(req, res, next) {
  if (!EXPECTED_TOKEN) {
    return res.status(500).json({ error: 'Servidor não configurado corretamente' });
  }
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Não autenticado' });
  }
  const token = authHeader.slice(7);
  if (token !== EXPECTED_TOKEN) {
    return res.status(401).json({ error: 'Token inválido' });
  }
  next();
}

// Middleware básico
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rota de teste (protegida por autenticação)
app.get('/', authenticate, (req, res) => {
  res.json({ status: 'ok' });
});

// Inicia o monitoramento de saúde após o servidor estar escutando
const server = app.listen(PORT, () => {
  console.log('Servidor iniciado');
  if (typeof startWatcher === 'function') {
    try {
      startWatcher();
    } catch (err) {
      console.error('Falha ao iniciar o watcher de saúde:', err.message);
    }
  }
});

module.exports = server;
