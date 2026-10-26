const AbuseLog = require('../../models/abuseLog');
const { verifyBearerToken } = require('../../netlify/functions/middleware');

module.exports = async (req, res) => {
  const h = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  if (req.method === 'OPTIONS') {
    return { statusCode: 200, headers: h, body: '' };
  }

  // Verificar autenticação
  const authResult = await verifyBearerToken(req);
  if (!authResult.ok) {
    return { 
      statusCode: 401, 
      headers: h, 
      body: JSON.stringify({ error: 'Não autenticado' }) 
    };
  }

  // Verificar se é admin ou master
  if (authResult.role !== 'admin' && authResult.role !== 'master') {
    return { 
      statusCode: 403, 
      headers: h, 
      body: JSON.stringify({ error: 'Permissão insuficiente. Apenas administradores podem acessar.' }) 
    };
  }

  try {
    const logs = await AbuseLog.find().sort({ timestamp: -1 }).limit(100);
    res.status(200).json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
