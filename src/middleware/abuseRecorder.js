const AbuseLog = require('../models/abuseLog');

const INJECTION_PATTERNS = [
  /union\\s+select/i,
  /drop\\s+table/i,
  /insert\\s+into/i,
  /delete\\s+from/i,
  /<script/i,
  /javascript:/i,
  /onerror\\s*=/i,
  /eval\s*\(/i,
  /\\$\\s*where/i,
  /this\\.constructor/i,
  /__proto__/i,
];

function extrairTextoRequisicao(req) {
  return JSON.stringify({
    query: req.query || {},
    params: req.params || {},
    body: req.body || {},
  });
}

function detectarAbuso(req) {
  const ip = req.ip || req.headers['x-forwarded-for'] || 'desconhecido';
  const userId = req.userId || null;

  // Rate-limit: header ou flag definida por middleware anterior
  if (req.headers['x-rate-limited'] === 'true' || req.rateLimited === true) {
    return {
      tipo: 'rate-limit',
      detalhes: 'Bloqueio por rate-limit',
      ip,
      userId,
    };
  }

  // Conteúdo proibido / tentativas de injection na query, params e body
  const texto = extrairTextoRequisicao(req);
  for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(texto)) {
    return {
      tipo: 'injection',
      detalhes: 'Padrão proibido detectado',
      ip,
      userId,
    };
  }
  }

  return null;
}

module.exports = async (req, res, next) => {
  const abuso = detectarAbuso(req);

  // Também registra sinalização de outro middleware
  if (!abuso && req.abuseTipo) {
    abuso = {
      tipo: req.abuseTipo || 'outro',
      detalhes: req.abuseDetalhes || '',
      ip: req.ip || 'desconhecido',
      userId: req.userId || null,
    };
  }

  if (abuso) {
    try {
      await AbuseLog.createAbuseLog(abuso);
      console.log(`Abuso registrado: ${abuso.tipo} por ${abuso.ip}`);
    } catch (err) {
      console.error('abuseRecorder: falha ao gravar log', err.message);
    }
  }

  next();
};