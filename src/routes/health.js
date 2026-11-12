'use strict';

// GET /api/prumo?acao=saude
// Esta rota responde com { ok:true, hora: ISO } quando acao=saude.
// Responde 200 com { ok: true, hora: <ISO> } quando acao=saude.
// Qualquer outra acao (ou acao ausente) responde 400 com mensagem clara.
// A resposta de saude traz o horario atual no formato ISO 8601 (new Date().toISOString()).
function responderSaude(req, res) {
  // Horario no formato ISO 8601 (ex.: 2026-01-31T12:34:56.789Z).
  // Sem cache: o horario tem que ser o do pedido, nao um valor guardado por um proxy.
  if (typeof res.set === 'function') res.set('Cache-Control', 'no-store');
  return res.status(200).json({ ok: true, hora: new Date().toISOString() });
}

function responderErro(req, res) {
  return res.status(400).json({ ok: false, erro: 'Parâmetro acao=saude obrigatório' });
}

module.exports = async function health(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const acao = url.searchParams.get('acao');

    if (acao === 'saude') {
      return responderSaude(req, res);
    }

    return responderErro(req, res);
  } catch (err) {
    console.error('[health] erro ao responder /api/prumo:', err && err.message ? err.message : err);
    return res.status(500).json({ ok: false, erro: 'Erro interno ao verificar a saúde.' });
  }
};

module.exports.responderSaude = responderSaude;
module.exports.responderErro = responderErro;
