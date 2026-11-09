'use strict';

module.exports = async function health(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const acao = url.searchParams.get('acao');
  const path = url.pathname;

  if (acao === 'saude') {
    return res.json({ ok: true, hora: new Date().toISOString() });
  }

  return res.status(404).json({ ok: false, erro: 'rota não encontrada' });
};
