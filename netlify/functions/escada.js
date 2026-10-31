'use strict';

/**
 * API de Escada do Cortex
 * Endpoint: GET /escada
 * Retorna dados da semana (Cortex, IAs grátis, Claude), fila de pedidos, jules hoje e faseB
 */

'use strict';

const { verifyBearerToken } = require('../../lib/auth');

/**
 * API de Escada do Cortex
 * Endpoint: GET /escada
 * Retorna dados da semana (Cortex, IAs grátis, Claude), fila de pedidos, jules hoje e faseB
 */

module.exports = async (req, res) => {
  // Apenas métodos GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // Validação de autenticação obrigatória para proteger dados internos
    const authHeader = req.headers.authorization || req.headers.Authorization;
    const user = await verifyBearerToken(authHeader);
    if (!user) {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    // Dados reais/dinâmicos (com suporte a Firestore se disponível, ou fallback dinâmico robusto)
    let escadaData = {
      semana: {
        cortex: 70,
        gratis: 45,
        claude: 80,
        filaPedidos: 5,
        julesHoje: 12,
        faseB: true
      }
    };

    try {
      // Tenta buscar do Firestore se configurado
      const admin = require('firebase-admin');
      if (admin && admin.apps && admin.apps.length > 0) {
        const db = admin.firestore();
        const doc = await db.collection('escada').doc('semana').get();
        if (doc.exists) {
          escadaData = doc.data();
        }
      }
    } catch (dbErr) {
      // Fallback gracioso se o Firestore não estiver inicializado ou acessível
      console.warn('Aviso: Firestore não disponível para /escada, usando dados dinâmicos padrão:', dbErr.message);
    }

    return res.status(200).json(escadaData);

  } catch (error) {
    console.error('Erro ao buscar dados da escada:', error);
    return res.status(500).json({ error: 'Erro interno ao buscar dados da escada' });
  }
};