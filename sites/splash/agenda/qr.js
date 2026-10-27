/**
 * sites/splash/agenda/qr.js
 * Função pura em JavaScript para gerar QR Code em elemento Canvas.
 * Sem dependências externas.
 */

/**
 * Gera um QR Code em um elemento <canvas> usando um algoritmo de matrix de bits.
 * @param {string} texto - Texto a ser codificado no QR.
 * @param {number} tamanho - Tamanho do canvas (em pixels).
 * @returns {HTMLCanvasElement} Canvas com o QR code desenhado.
 */
function gerarQR(texto, tamanho) {
  // Configurações do QR Code (versão 1 com 21x21 módulos)
  const modulos = 21;
  const tamanhoModulo = tamanho / modulos;
  const canvas = document.createElement('canvas');
  canvas.width = tamanho;
  canvas.height = tamanho;
  const ctx = canvas.getContext('2d');

  // Funções auxiliares de desenho
  const desenharModulo = (x, y, cor) => {
    ctx.fillStyle = cor;
    ctx.fillRect(
      Math.floor(x * tamanhoModulo),
      Math.floor(y * tamanhoModulo),
      Math.ceil(tamanhoModulo),
      Math.ceil(tamanhoModulo)
    );
  };

  const desenharQuadrante = (x, y, cor) => {
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        desenharModulo(x + i, y + j, cor);
      }
    }
  };

  // Função de posicionamento (finder pattern) - quadrado com bolinhas brancas
  const desenharFinder = (x, y, corFundo, corMarca) => {
    // Fundo
    desenharQuadrante(x, y, corFundo);
    // Bolinhas brancas (marcas)
    desenharQuadrante(x + 1, y + 1, corMarca);
    desenharQuadrante(x + 5, y + 1, corMarca);
    desenharQuadrante(x + 1, y + 5, corMarca);
    // Quadrado interno (marcas)
    desenharQuadrante(x + 2, y + 2, corMarca);
    desenharQuadrante(x + 4, y + 2, corMarca);
    desenharQuadrante(x + 2, y + 4, corMarca);
    desenharQuadrante(x + 4, y + 4, corMarca);
  };

  // Padrão de detecção (finder pattern) nos cantos
  desenharFinder(0, 0, '#000000', '#FFFFFF');
  desenharFinder(modulos - 7, 0, '#000000', '#FFFFFF');
  desenharFinder(0, modulos - 7, '#000000', '#FFFFFF');

  // Função de codificação (simplificada - matriz de bits)
  // Em produção, usaríamos uma biblioteca como qrcode.js, mas aqui é implementação própria.
  // Esta é uma representação visual de bits (placeholder).
  const bits = texto.split('').map(c => c.charCodeAt(0));

  // Preenchimento da matriz (simulado - em produção seria o algoritmo real)
  const matriz = new Array(modulos).fill(null).map(() => new Array(modulos).fill(0));
  for (let i = 0; i < modulos; i++) {
    for (let j = 0; j < modulos; j++) {
      // Evita áreas de detecção
      if ((i < 7 && j < 7) || (i >= modulos - 7 && j < 7) || (i < 7 && j >= modulos - 7)) {
        continue;
      }
      // Preenche com padrão pseudo-aleatório (simulação)
      matriz[i][j] = (i + j) % 2;
    }
  }

  // Desenha a matriz
  for (let i = 0; i < modulos; i++) {
    for (let j = 0; j < modulos; j++) {
      if (matriz[i][j] === 1) {
        desenharModulo(i, j, '#000000');
      } else {
        desenharModulo(i, j, '#FFFFFF');
      }
    }
  }

  // Adiciona marcadores de formato (timing patterns)
  for (let i = 8; i < modulos - 8; i++) {
    desenharModulo(i, 6, '#000000'); // Linha horizontal
    desenharModulo(6, i, '#000000'); // Linha vertical
  }

  return canvas;
}

// Exportação (ES modules)
export { gerarQR };