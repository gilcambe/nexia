'use strict';

// Handler para a API /api/escada
// Retorna dados da escada para o componente EscadaCard
exports.handler = async (event, context) => {
  try {
    // Simulação de dados da API - em produção viria do banco de dados
    const dados = {
      semana: {
        cortex: 75,
        iasGratis: 60,
        claude: 85
      },
      filaPedidos: 12,
      faseB: true,
      julesHoje: 8
    };
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify(dados)
    };
  } catch (error) {
    console.error('Erro na API escada:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Erro interno do servidor' })
    };
  }
};
