const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const usuarioController = require('../controllers/usuarioController');

router.post('/usuario-salvar', auth, usuarioController.usuarioSalvar);
router.get('/usuario-listar', auth, usuarioController.usuarioListar);
router.patch('/usuario-desativar/:id', auth, usuarioController.usuarioDesativar);

module.exports = router;
