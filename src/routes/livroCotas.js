const express = require('express');
const router = express.Router();
const LivroCota = require('../models/LivroCota');

router.get('/livro_cotas', async (req, res) => {
  try {
    const linhas = await LivroCota.findAll();
    if (!linhas || linhas.length === 0) {
      return res.json({ mensagem: "sem dados" });
    }
    return res.json(linhas);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
