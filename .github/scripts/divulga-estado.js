'use strict';
const fs = require('fs');
const path = require('path');

function gerarResumoSeguidores(jsonPath = path.resolve('dados/divulga-estado.json')) {
  let summary = '';
  try {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const listaRaw = data.seguidores || data.estado || [];
    const lista = Array.isArray(listaRaw) ? listaRaw : [];
    if (!lista.length) throw new Error('empty');

    const recent = lista.slice(-14).map((item) => {
      const val = typeof item.total === 'number' ? item.total : item.seguidores;
      return {
        dia: item.dia,
        seguidores: Number(val || 0),
      };
    });

    if (!recent.length) throw new Error('empty');

    summary += '| Dia | Seguidores |\n| --- | ----------- |\n';
    recent.forEach((item) => {
      let date = item.dia;
      if (typeof item.dia === 'string' && /^\d{4}-\d{2}-\d{2}/.test(item.dia)) {
        const [yyyy, mm, dd] = item.dia.slice(0, 10).split('-');
        date = `${dd}/${mm}/${yyyy}`;
      } else if (item.dia) {
        const d = new Date(item.dia);
        if (!isNaN(d.getTime())) {
          date = d.toLocaleDateString('pt-BR');
        }
      }
      summary += `| ${date} | ${item.seguidores} |\n`;
    });

    const first = recent[0].seguidores;
    const last = recent[recent.length - 1].seguidores;
    const diff = last - first;
    const sign = diff >= 0 ? '+' : '-';
    summary += `\n${sign}${Math.abs(diff)} seguidores em ${recent.length} dias`;
  } catch (e) {
    summary = 'Sem dados de seguidores ainda';
  }
  return summary;
}

function main() {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  const summary = gerarResumoSeguidores();
  if (summaryPath) {
    fs.appendFileSync(summaryPath, summary);
  } else {
    console.log(summary);
  }
}

if (require.main === module) {
  main();
}

module.exports = { gerarResumoSeguidores, main };
