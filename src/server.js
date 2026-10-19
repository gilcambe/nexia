'use strict';
/**
 * Servidor NEXIA — expõe /health e inicia o Health Watcher.
 */

const http = require('http');
const { startHealthWatcher } = require('../monitoring/healthWatcher');

const PORT = parseInt(process.env.PORT, 10) || 3001;

const server = http.createHandler ? null : null; // placeholder mantido sem quebrar importações futuras

function handleRequest(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'nexia-api', timestamp: new Date().toISOString() }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
}

const httpServer = http.createServer(handleRequest);

function start() {
  httpServer.listen(PORT, () => {
    console.log(`[server] NEXIA API rodando na porta ${PORT}`);
    startHealthWatcher();
  });
}

if (require.main === module) {
  start();
}

module.exports = {
  start,
  app: httpServer,
};
