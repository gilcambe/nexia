'use strict';

// Rota validada para /livro_cotas

const express = require('express');
const router = express.Router();

// Aceita tanto o objeto de models ({ LivroCota }) quanto um router pronto
// (quando a montagem usa models sem cadastrar o model, o handler segue
// vivo porque "this" do router pertence ao LivroCota).
module.exports = (models) => {
  const LivroCota = (models && (models.LivroCota || models.livroCota)) || models;

  // GET /livro_cotas -> { mensagem, dados }
// Sem linhas: 200 { mensagem: 'sem dados', dados: [] } (nunca 500).
// Com linhas: 200 { mensagem: 'ok', dados: [...] } com numero (id) e hora
// (data do registro) em cada item, ordenado por id.
// Só falha real na consulta responde 500 { mensagem: 'erro ao consultar livro_cotas' },
// sem expor detalhes internos.

  // GET /livro_cotas: todas as linhas (ou "sem dados") + /livro_cotas/numero/:id/hora
  router.get('/livro_cotas', async (req, res) => {
    try {
      let registros = [];
      if (LivroCota && typeof LivroCota.findAll === 'function') {
        // Sem "attributes.exclude": createdAt e updatedAt precisam vir do banco
        // para a hora de cada registro ser a data real (e não a hora atual).
        registros = await LivroCota.findAll({ order: [['id', 'ASC']] });
      }

      if (!registros || registros.length === 0) {
        // Sem linhas: devolve a mensagem pedida.
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

      return res.status(200).json({ mensagem: 'ok', dados: formatados });
    } catch (err) {
      console.error('livroCotas: falha na consulta', err);
      // Sem detalhes internos (mensagem do banco, stack): só a mensagem genérica.
      return res.status(500).json({ mensagem: 'erro ao consultar livro_cotas' });
    }
  });

  // A fabrica (module.exports) recebe models e devolve o router montado.
  // O router tambem fica como propriedade, sem sobrescrever a fabrica.
  module.exports.router = router;
  module.exports.livroCotasRouter = router;

  return router;
};
