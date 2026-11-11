'use strict';

// GET /api/prumo?acao=saude
// Responde 200 com { ok: true, hora: <ISO> } quando acao=saude.
// Qualquer outra acao (ou acao ausente) responde 400 com mensagem clara.
module.exports = async function health(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const acao = url.searchParams.get('acao');

  if (acao === 'saude') {
    return res.status(200).json({ ok: true, hora: new Date().toISOString() });
  }

  return res.status(400).json({ ok: false, erro: 'Parâmetro acao=saude obrigatório' });
};
