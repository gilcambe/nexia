'use strict';

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
    // Simulação de dados da escada (podem vir de Firestore ou outro banco de dados)
    const escadaData = {
      semana: {
        cortex: 65,           // Progresso do Cortex na semana
        gratis: 30,           // Progresso das IAs grátis na semana
        claude: 75,           // Progresso do Claude na semana
        filaPedidos: 12,      // Número de pedidos na fila
        julesHoje: 8,         // Jules hoje (de 15)
        faseB: false          // Pronto para fase B
      }
    };

    // Em produção, esses dados viriam de um banco de dados (Firestore, D1, etc.)
    // const doc = await firestore.collection('escada').doc('semana').get();
    // const escadaData = doc.exists ? doc.data() : { semana: { cortex: 0, gratis: 0, claude: 0, filaPedidos: 0, julesHoje: 0, faseB: false } };

    return res.status(200).json(escadaData);

  } catch (error) {
    console.error('Erro ao buscar dados da escada:', error);
    return res.status(500).json({ error: 'Erro interno ao buscar dados da escada' });
  }
};