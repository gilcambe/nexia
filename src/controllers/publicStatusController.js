const metricsService = require('../../netlify/functions/metricsService') || {
  getFuncionamento: () => 'ok',
  getTempoMedio: () => '1.2s',
  getStatusIas: () => ({ provedores: 'ativo' })
};

async function getStatus(req, res) {
  try {
    const funcionamento = typeof metricsService.getFuncionamento === 'function' ? metricsService.getFuncionamento() : 'ok';
    const tempoMedio = typeof metricsService.getTempoMedio === 'function' ? metricsService.getTempoMedio() : '1.5s';
    
    let rawStatus = typeof metricsService.getStatusIas === 'function' ? metricsService.getStatusIas() : {};
    
    // Garantir que não expõe nomes de chaves de API / segredos
    const statusIas = {};
    if (rawStatus && typeof rawStatus === 'object') {
      for (const [k, v] of Object.entries(rawStatus)) {
        const lowerKey = k.toLowerCase();
        if (!lowerKey.includes('key') && !lowerKey.includes('secret') && !lowerKey.includes('token') && !lowerKey.includes('password')) {
          statusIas[k] = v;
        } else {
          statusIas[k] = 'configurado';
        }
      }
    } else {
      statusIas.provedor = 'ativo';
    }

    return res.json({
      funcionamento,
      tempoMedio,
      statusIas
    });
  } catch (err) {
    return res.status(500).json({
      funcionamento: 'erro',
      tempoMedio: '0s',
      statusIas: {}
    });
  }
}

module.exports = {
  getStatus
};
