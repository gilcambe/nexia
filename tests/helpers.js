'use strict';
const http = require('http');

// Requisição HTTP crua: o caminho vai exatamente como escrito (sem normalização
// do cliente), para exercitar path traversal de verdade.
function rawRequest(port, rawPath, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path: rawPath, headers }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    if (body !== undefined) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

async function startServer() {
  const { server } = require('../server.js');
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return { server, port: server.address().port, close: () => new Promise(r => server.close(r)) };
}

module.exports = { rawRequest, startServer };
