const fs = require('fs');
const axios = require('axios');

const perguntas = JSON.parse(fs.readFileSync('tests/qualidade/cortex-30-perguntas.json', 'utf8'));

async function runQualityTest() {
  const resultados = [];
  const startTime = Date.now();

  for (const pergunta of perguntas) {
    const perguntaStartTime = Date.now();
    const response = await axios.post('/api/cortex', { pergunta: pergunta.pergunta });
    const perguntaEndTime = Date.now();
    const tempoTotal = perguntaEndTime - perguntaStartTime;

    const juizResponse = await axios.post('/api/juiz', {
      resposta: response.data.resposta,
      resposta_esperada: pergunta.resposta_esperada
    });

    resultados.push({
      pergunta: pergunta.pergunta,
      resposta: response.data.resposta,
      tempoTotal,
      nota: juizResponse.data.nota
    });
  }

  const endTime = Date.now();
  const tempoTotalGeral = endTime - startTime;

  const relatorio = {
    resultados,
    tempoTotalGeral,
    notaMedia: resultados.reduce((acc, curr) => acc + curr.nota, 0) / resultados.length,
    p95Tempo: calcularP95(resultados.map(r => r.tempoTotal))
  };

  fs.writeFileSync('tests/qualidade/relatorio-cortex-qualidade.json', JSON.stringify(relatorio, null, 2));

  console.log('Relatório de qualidade gerado com sucesso!');
}

function calcularP95(tempos) {
  tempos.sort((a, b) => a - b);
  const index = Math.ceil(tempos.length * 0.95) - 1;
  return tempos[index];
}

runQualityTest().catch(console.error);
