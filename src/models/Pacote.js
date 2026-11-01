const mongoose = require('mongoose');

const PacoteSchema = new mongoose.Schema({
  nome: {
    type: String,
    required: [true, 'O nome do pacote é obrigatório'],
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
  preço: {
    type: Number,
    required: [true, 'O preço é obrigatório'],
    min: [0, 'O preço não pode ser negativo']
  },
  disponibilidade: {
    type: Number,
    required: [true, 'A disponibilidade é obrigatória'],
    min: [0, 'A disponibilidade não pode ser negativa'],
    default: 1
  }
}, {
  timestamps: true
});

PacoteSchema.index({ nome: 1, país: 1 });

module.exports = mongoose.model('Pacote', PacoteSchema);