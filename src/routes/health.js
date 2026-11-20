'use strict';

/**
/**
 * Handler de saúde para /api/prumo?acao=saude
 */
module.exports = function health(req, res) {
  const acao = req.query && req.query.acao; // health check
  if (acao === 'saude') {
    return res.json({
      ok: true,
      hora: new Date().toISOString()
    });
  }
  return res.status(400).json({
    ok: false,
    erro: 'Ação inválida ou não informada'
  });
};

