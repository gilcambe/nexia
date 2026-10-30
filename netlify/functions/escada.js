'use strict';

// Simulação de dados da escada - em um ambiente real, estes viriam de um banco de dados ou API
const ESCADA_DATA = {
  cortex: 75,
  gratis: 60,
  claude: 85,
  filaAtual: 12,
  julesHoje: 8,
  faseB: true
};

exports.handler = async (event, context) => {
  try {
    // Em um ambiente real, você buscaria esses dados de um banco de dados ou outra fonte
    const data = ESCADA_DATA;
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: JSON.stringify(data)
    };
  } catch (error) {
    console.error('Erro no handler escada:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: JSON.stringify({ error: 'Erro ao buscar dados da escada' })
    };
  }
};