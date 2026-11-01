const mongoose = require('mongoose');

const historicoSchema = new mongoose.Schema({
  usuarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  acao: {
    type: String,
    required: true
  },
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  itemTipo: {
    type: String,
    required: true
  },
  data: {
    type: Date,
    default: Date.now
  },
  camposAlterados: [{
    campo: String,
    antes: mongoose.Schema.Types.Mixed,
    depois: mongoose.Schema.Types.Mixed
  }]
});

module.exports = mongoose.model('Historico', historicoSchema);
