'use strict';
// Resposta em streaming para os handlers no formato Netlify (Fase 5).
// Um handler pode devolver { statusCode, headers, stream } em vez de { body }:
// `stream` é um async iterable de strings/Buffers escritos em `res` à medida que chegam.
// Se o cliente desconectar, o iterador é encerrado (return()), o que cancela a chamada
// ao provedor de IA do outro lado.
function isStreamResult(result) {
  return !!(result && result.stream && typeof result.stream[Symbol.asyncIterator] === 'function');
}

async function writeStream(req, res, result, baseHeaders = {}) {
  res.writeHead(result.statusCode || 200, { ...baseHeaders, ...(result.headers || {}), 'X-Accel-Buffering': 'no' });
  if (typeof res.flushHeaders === 'function') res.flushHeaders();
  const it = result.stream[Symbol.asyncIterator]();
  let closed = false;
  const onClose = () => {
    if (closed) return;
    closed = true;
    if (typeof it.return === 'function') Promise.resolve(it.return()).catch(() => {});
  };
  res.on('close', onClose);
  try {
    while (!closed) {
      const n = await it.next();
      if (n.done || closed) break;
      if (n.value === undefined || n.value === null || n.value === '') continue;
      if (!res.write(n.value)) await new Promise(r => { res.once('drain', r); res.once('close', r); });
    }
  } catch (e) {
    console.warn('[STREAM] interrompido:', e && e.code ? e.code : 'erro');
  } finally {
    res.off('close', onClose);
    if (!res.writableEnded) res.end();
  }
}

module.exports = { isStreamResult, writeStream };
