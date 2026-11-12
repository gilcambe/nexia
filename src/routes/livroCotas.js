'use strict';

const express = require('express');
const router = express.Router();

module.exports = (models) => {
  const LivroCota = models && models.LivroCota;

  router.get('/livro_cotas', async (req, res) => {
    try {
      let registros = [];
      if (LivroCota && typeof LivroCota.findAll === 'function') {
        registros = await LivroCota.findAll();
      }

      if (!registros || registros.length === 0) {
        return res.status(200).json({ mensagem: 'sem dados' });
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
          hora
        };
      });

      return res.status(200).json(formatados);
    } catch (err) {
      return res.status(200).json({ mensagem: 'sem dados' });
    }
  });

  return router;
};
