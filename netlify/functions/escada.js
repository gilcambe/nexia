const handler = async (event, context) => {
  try {
    // Dados simulados por enquanto, depois podemos buscar de uma fonte real
    const dados = {
      faseB: true,
      fila: 12,
      julesHoje: "8/15",
      semana: {
        cortex: 80,
        iasGratis: 95,
        claude: 70
      }
    };
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dados),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Erro ao buscar dados da escada' }),
    };
  }
};

module.exports = { handler };