const mongoose = require('mongoose');

const DestinoSchema = new mongoose.Schema({
  nome: {
    type: String,
    required: [true, 'O nome do destino é obrigatório'],
    trim: true,
    maxlength: [100, 'O nome não pode ter mais de 100 caracteres']
  },
  país: {
    type: String,
    required: [true, 'O país é obrigatório'],
    trim: true,
    maxlength: [50, 'O país não pode ter mais de 50 caracteres']
  },
  região: {
    type: String,
    required: [true, 'A região é obrigatória'],
    trim: true,
    maxlength: [50, 'A região não pode ter mais de 50 caracteres']
  },
  descrição: {
    type: String,
    required: [true, 'A descrição é obrigatória'],
    trim: true,
    maxlength: [2000, 'A descrição não pode ter mais de 2000 caracteres']
  },
  fotos: [{
    url: {
      type: String,
      required: [true, 'A URL da foto é obrigatória']
    },
    legenda: {
      type: String,
      trim: true,
      maxlength: [200, 'A legenda não pode ter mais de 200 caracteres']
    }
  }],
  ativo: {
    type: Boolean,
    default: true
  },
  criadoEm: {
    type: Date,
    default: Date.now
  },
}, {
  timestamps: true
});

DestinoSchema.index({ nome: 1, país: 1 });

module.exports = mongoose.model('Destino', DestinoSchema);