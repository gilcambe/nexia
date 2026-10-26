const express = require('express');
const router = express.Router();
const publicStatusController = require('../controllers/publicStatusController');

router.get('/cortex/status', publicStatusController.getStatus);

module.exports = router;
