const express = require('express');
const PORT = process.env.PORT || 3000;

const app = express();

// Middleware básico
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rota de teste
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Servidor está rodando' });
});

// ... outras importações existentes
const { startWatcher } = require('./monitoring/healthWatcher');

// ... código de inicialização do Express/App existente

// Inicia o monitoramento de saúde após o servidor estar escutando
const server = app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  // Inicia o watcher de saúde
  startWatcher();
});

module.exports = server;