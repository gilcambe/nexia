/**
 * Gera uma string SVG contendo gráfico de barras para a série de dados fornecida.
 * Cada item deve conter { rotulo: string, valor: number }.
 * Retorna exatamente a quantidade de <rect> equivalente ao número de itens na série.
 *
 * @param {Array<{ rotulo?: string, valor?: number }>} series
 * @param {object} [opcoes]
 * @returns {string} String contendo SVG
 */
function desenharBarras(series, opcoes = {}) {
  const lista = Array.isArray(series) ? series : [];
  const largura = opcoes.largura || 400;
  const altura = opcoes.altura || 200;
  const margem = opcoes.margem || { topo: 20, direita: 20, base: 30, esquerda: 30 };

  const areaUtilLargura = Math.max(10, largura - margem.esquerda - margem.direita);
  const areaUtilAltura = Math.max(10, altura - margem.topo - margem.base);

  const valores = lista.map((d) => (typeof d.valor === 'number' ? d.valor : 0));
  const maxValor = valores.length > 0 ? Math.max(...valores, 1) : 1;

  const n = lista.length;
  const gap = n > 0 ? Math.max(4, areaUtilLargura * 0.05 / n) : 0;
  const larguraBarra = n > 0 ? Math.max(1, (areaUtilLargura - (n - 1) * gap) / n) : 0;

  const retangulos = lista.map((item, i) => {
    const val = typeof item.valor === 'number' ? item.valor : 0;
    const alturaBarra = (val / maxValor) * areaUtilAltura;
    const x = margem.esquerda + i * (larguraBarra + gap);
    const y = margem.topo + (areaUtilAltura - alturaBarra);
    const rotulo = item.rotulo ? String(item.rotulo) : '';
    return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${larguraBarra.toFixed(2)}" height="${alturaBarra.toFixed(2)}" fill="#3b82f6" data-rotulo="${rotulo}" data-valor="${val}"></rect>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${largura} ${altura}" width="${largura}" height="${altura}">${retangulos.join('')}</svg>`;
}

/**
 * Carrega dados-exemplo.json e inicializa o gráfico no DOM.
 */
function carregarEInicializar() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  function renderizar(dados) {
    const series = (dados && Array.isArray(dados.series)) ? dados.series : [];
    const svgHtml = desenharBarras(series);
    let container = document.getElementById('painel') || document.getElementById('grafico');
    if (!container) {
      container = document.createElement('div');
      container.id = 'painel';
      document.body.appendChild(container);
    }
    container.innerHTML = svgHtml;
  }

  const url = 'dados-exemplo.json';
  if (typeof fetch === 'function') {
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error('Falha ao carregar dados');
        return res.json();
      })
      .then((dados) => renderizar(dados))
      .catch((_) => {
        // Fallback em caso de erro ao carregar caminho relativo
      });
  } else if (typeof XMLHttpRequest !== 'undefined') {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4 && xhr.status === 200) {
        try {
          const dados = JSON.parse(xhr.responseText);
          renderizar(dados);
        } catch (_) {}
      }
    };
    xhr.send();
  }
}

if (typeof window !== 'undefined') {
  window.desenharBarras = desenharBarras;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', carregarEInicializar);
  } else {
    carregarEInicializar();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { desenharBarras, carregarEInicializar };
}
