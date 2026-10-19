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
