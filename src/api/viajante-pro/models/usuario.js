const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const usuarioSchema = new mongoose.Schema({
  nome: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  perfil: {
    type: String,
    required: true,
    enum: ['dono', 'gerente', 'atendente', 'financeiro']
  },
  ativo: {
    type: Boolean,
    default: true
  },
  senha: {
    type: String,
    required: true,
    minlength: 6
  }
}, {
  timestamps: true
});

usuarioSchema.pre('save', async function(next) {
  const usuario = this;
  if (usuario.isModified('senha')) {
    usuario.senha = await bcrypt.hash(usuario.senha, 8);
  }
  next();
});

usuarioSchema.methods.toJSON = function() {
  const usuario = this;
  const usuarioObject = usuario.toObject();

  delete usuarioObject.senha;

  return usuarioObject;
};

usuarioSchema.statics.findByCredentials = async (email, senha) => {
  const usuario = await Usuario.findOne({ email });

  if (!usuario) {
    throw new Error('Não foi possível fazer login');
  }

  const isMatch = await bcrypt.compare(senha, usuario.senha);

  if (!isMatch) {
    throw new Error('Não foi possível fazer login');
  }

  return usuario;
};

const Usuario = mongoose.model('Usuario', usuarioSchema);

module.exports = Usuario;
