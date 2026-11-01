const Historico = require('../models/historico');

const sensitiveFields = ['senha', 'documento'];

const historicoLogger = (req, res, next) => {
  const originalSend = res.send;

  res.send = function (body) {
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
      const acao = req.path.split('/').pop();
      const itemId = req.body._id || req.params.id;
      const itemTipo = req.path.split('/')[2];
      const usuarioId = req.user ? req.user._id : null;

      if (itemId && itemTipo && usuarioId) {
        const camposAlterados = [];

        if (req.method === 'PUT') {
          const oldData = req.oldData || {};
          const newData = req.body;

          for (const key in newData) {
            if (!sensitiveFields.includes(key) && oldData[key] !== newData[key]) {
              camposAlterados.push({
                campo: key,
                antes: oldData[key],
                depois: newData[key]
              });
            }
          }
        }

        const historico = new Historico({
          usuarioId,
          acao,
          itemId,
          itemTipo,
          camposAlterados
        });

        historico.save().catch(err => console.error('Erro ao salvar histórico:', err));
      }
    }

    originalSend.call(this, body);
  };

  next();
};

module.exports = historicoLogger;
