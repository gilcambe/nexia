const AbuseLog = require('../models/abuseLog');

module.exports = async (req, res, next) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || 'desconhecido';
  const userId = req.userId || null;

  // Verifica se há tipo de abuso definido no request
  const tipo = req.abuseTipo || null;
  const detalhes = req.abuseDetalhes || '';

  if (tipo) {
    try {
      await AbuseLog.create({ ip, userId, tipo, detalhes });
      console.log(`Abuso registrado: ${tipo} por ${ip}`);
    } catch (err) {
      console.error('abuseRecorder: falha ao gravar log', err.message);
    }
  }

  next();
};
