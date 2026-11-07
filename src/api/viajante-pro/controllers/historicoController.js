const Historico = require('../models/historico');

exports.listarHistorico = async (req, res) => {
  try {
    const { itemId, itemTipo, usuarioId } = req.query;
    const query = {};

    if (itemId) query.itemId = itemId;
    if (itemTipo) query.itemTipo = itemTipo;
    if (usuarioId) query.usuarioId = usuarioId;

    const historico = await Historico.find(query).sort({ data: -1 });

    res.json(historico);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
