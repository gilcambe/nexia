const Usuario = require('../models/usuario');

const usuarioSalvar = async (req, res) => {
  try {
    const { perfil } = req.user;

    if (perfil !== 'dono' && perfil !== 'gerente') {
      return res.status(403).send({ error: 'Acesso negado' });
    }

    const usuario = new Usuario(req.body);
    await usuario.save();
    res.status(201).send(usuario);
  } catch (error) {
    res.status(400).send(error);
  }
};

const usuarioListar = async (req, res) => {
  try {
    const usuarios = await Usuario.find({ ativo: true });
    res.send(usuarios);
  } catch (error) {
    res.status(500).send(error);
  }
};

const usuarioDesativar = async (req, res) => {
  try {
    const { perfil } = req.user;

    if (perfil !== 'dono' && perfil !== 'gerente') {
      return res.status(403).send({ error: 'Acesso negado' });
    }

    const usuario = await Usuario.findByIdAndUpdate(
      req.params.id,
      { ativo: false },
      { new: true }
    );

    if (!usuario) {
      return res.status(404).send();
    }

    res.send(usuario);
  } catch (error) {
    res.status(500).send(error);
  }
};

module.exports = {
  usuarioSalvar,
  usuarioListar,
  usuarioDesativar
};
