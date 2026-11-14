'use strict';

module.exports = function health(req, res) {
  const acao = req.query && req.query.acao;
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
