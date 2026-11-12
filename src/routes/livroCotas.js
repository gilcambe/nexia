'use strict';

const express = require('express');
const router = express.Router();

module.exports = (models) => {
  const LivroCota = models && models.LivroCota;

  // GET /livro_cotas: todas as linhas (ou "sem dados") + /livro_cotas/numero/:id/hora
  router.get(['/livro_cotas', '/livro_cotas/numero/:id/hora'], async (req, res) => {
    try {
      let registros = [];
      if (LivroCota && typeof LivroCota.findAll === 'function') {
        registros = await LivroCota.findAll({
          attributes: { exclude: ['createdAt', 'updatedAt'] },
          order: [['id', 'ASC']]
        });
      }

      if (!registros || registros.length === 0) {
        return res.status(200).json({ mensagem: 'sem dados', dados: [] });
      }

      const formatados = registros.map(item => {
        const dataVal = item.createdAt || item.updatedAt || item.reset_at || new Date();
        const dataObj = new Date(dataVal);
        const numero = item.id || item.getDataValue?.('id') || 0;
        const hora = !isNaN(dataObj.getTime()) ? dataObj.toISOString() : String(dataVal);
        const bruto = typeof item.toJSON === 'function' ? item.toJSON() : item;
        return {
          ...bruto,
          numero,
          hora,
          // data de criação legível: "AAAA-MM-DD HH:MM:SS" (UTC), sem depender de fuso
          data_criacao: !isNaN(dataObj.getTime())
            ? dataObj.toISOString().slice(0, 19).replace('T', ' ')
            : String(dataVal)
        };
      });

      return res.status(200).json(formatados);
    } catch (err) {
      return res.status(500).json({ mensagem: 'erro ao consultar livro_cotas' });
    }
  });

  // Rota montada por src/index.js; exports nomeado para uso direto nos testes.
  module.exports = router;
  module.exports.livroCotas = router;

  return router;
};
