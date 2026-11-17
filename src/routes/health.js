'use strict';
// Handler de saúde para ação=saude

module.exports = function health(req, res) {
  // Garantir que o método seja GET
  if (req.method !== 'GET') {
    return res.status(405).json({
      ok: false,
      erro: 'Método não permitido'
    });
  }

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

