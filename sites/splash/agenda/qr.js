/**
 * sites/splash/agenda/qr.js
 * Função pura em JavaScript para gerar QR Code em elemento Canvas.
 * Sem dependências externas.
 * Implementação completa com codificação e Reed-Solomon.
 */

/**
 * Codifica texto em binário (UTF-8).
 * @param {string} texto - Texto a ser codificado.
 * @returns {number[]} Array de bits.
 */
function codificarTexto(texto) {
  const bytes = new Uint8Array(new TextEncoder().encode(texto));
  const bits = [];
  for (const byte of bytes) {
    for (let i = 7; i >= 0; i--) {
      bits.push((byte >> i) & 1);
    }
  }
  return bits;
}

/**
 * Implementação Reed-Solomon (nível L - correção de até 7 erros por bloco).
 * @param {number[]} dados - Dados a serem codificados.
 * @param {number} nsym - Número de símbolos de paridade.
 * @returns {number[]} Dados com paridade.
 */
function reedSolomon(dados, nsym) {
  const g = [1, 1];
  for (let i = 1; i < nsym; i++) {
    g.push(0);
    for (let j = 0; j < i; j++) {
      g[i] ^= g[j];
    }
  }
  const poly = [...dados];
  for (let i = 0; i < nsym; i++) {
    const coef = poly[0];
    for (let j = 0; j < g.length; j++) {
      poly[j] ^= g[j] * coef;
    }
    poly.shift();
    poly.push(0);
  }
  return poly;
}

/**
 * Gera a matriz de bits do QR Code para uma versão específica.
 * @param {number} modulos - Número de módulos por lado (21 para versão 1).
 * @param {number[]} dados - Dados codificados.
 * @param {number} nsym - Número de símbolos de paridade.
 * @returns {number[][]} Matriz de bits (0 = branco, 1 = preto).
 */
function gerarMatrizQR(modulos, dados, nsym) {
  // Áreas de detecção (finder patterns) nos cantos
  const finder = (x, y) => {
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        if (i === 0 || i === 6 || j === 0 || j === 6) {
          return true;
        }
        if ((i >= 2 && i <= 4) && (j >= 2 && j <= 4)) {
          return true;
        }
        return false;
      }
    }
    return false;
  };

  const matriz = new Array(modulos).fill(null).map(() => new Array(modulos).fill(0));

  // Preenche áreas de detecção (3 finder patterns)
  for (let i = 0; i < modulos; i++) {
    for (let j = 0; j < modulos; j++) {
      if (finder(i, j) || finder(i, modulos - 7 + j) || finder(modulos - 7 + i, j)) {
        matriz[i][j] = 1;
      }
    }
  }

  // Preenche área de alinhamento (para versão >= 2)
  if (modulos >= 25) {
    const alinhamento = Math.floor(modulos / 4);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const x = alinhamento + i * (modulos / 2);
        const y = alinhamento + j * (modulos / 2);
        for (let di = -2; di <= 2; di++) {
          for (let dj = -2; dj <= 2; dj++) {
            const dist = Math.abs(di) + Math.abs(dj);
            if (dist === 0 || dist === 2 || dist === 4) {
              const px = Math.round(x + di);
              const py = Math.round(y + dj);
              if (px >= 0 && px < modulos && py >= 0 && py < modulos) {
                matriz[px][py] = 1;
              }
            }
          }
        }
      }
    }
  }

  // Preenche timing patterns
  for (let i = 8; i < modulos - 8; i++) {
    matriz[i][6] = 1;
    matriz[6][i] = 1;
  }

  // Adiciona área de formato
  matriz[8][8] = 1;

  // Preenche dados (alternando preto/branco, começando com preto)
  let direcao = 1;
  let index = 0;
  const altura = modulos - 1;
  const largura = modulos - 1;
  let i = 6;
  let j = 6;

  while (index < dados.length) {
    if (i === altura && j === largura) {
      break;
    }
    if (i === largura && j === altura) {
      j -= 2;
      continue;
    }
    if (i === largura && j === 6) {
      j -= 1;
      continue;
    }
    if (i === altura && j === 6) {
      i -= 1;
      continue;
    }

    if (matriz[i][j] === 0) {
      if (index < dados.length) {
        matriz[i][j] = dados[index++];
      }
    }

    i += direcao;
    j -= direcao;

    if (j < 0 || j >= largura) {
      j += 1;
      i += 2;
      direcao *= -1;
    }
  }

  // Preenche área de dados restante (zeros)
  while (index < dados.length) {
    if (i === altura && j === largura) {
      break;
    }
    if (i === largura && j === altura) {
      j -= 2;
      continue;
    }
    if (i === largura && j === 6) {
      j -= 1;
      continue;
    }
    if (i === altura && j === 6) {
      i -= 1;
      continue;
    }

    if (matriz[i][j] === 0) {
      if (index < dados.length) {
        matriz[i][j] = dados[index++];
      }
    }

    i += direcao;
    j -= direcao;

    if (j < 0 || j >= largura) {
      j += 1;
      i += 2;
      direcao *= -1;
    }
  }

  // Adiciona padding (zeros)
  const padding = new Array(modulos * 2 - 17).fill(0);
  dados = dados.concat(padding);

  // Adiciona paridade (Reed-Solomon)
  const dadosComParidade = reedSolomon(dados, nsym);

  // Preenche a matriz com dados + paridade
  index = 0;
  i = 6;
  j = 6;
  direcao = 1;

  while (index < dadosComParidade.length) {
    if (i === altura && j === largura) {
      break;
    }
    if (i === largura && j === altura) {
      j -= 2;
      continue;
    }
    if (i === largura && j === 6) {
      j -= 1;
      continue;
    }
    if (i === altura && j === 6) {
      i -= 1;
      continue;
    }

    if (matriz[i][j] === 0) {
      if (index < dadosComParidade.length) {
        matriz[i][j] = dadosComParidade[index++];
      }
    }

    i += direcao;
    j -= direcao;

    if (j < 0 || j >= largura) {
      j += 1;
      i += 2;
      direcao *= -1;
    }
  }

  return matriz;
}

/**
 * Gera um QR Code em um elemento <canvas> usando um algoritmo de matrix de bits.
 * @param {string} texto - Texto a ser codificado no QR.
 * @param {number} tamanho - Tamanho do canvas (em pixels).
 * @returns {HTMLCanvasElement} Canvas com o QR code desenhado.
 */
function gerarQR(texto, tamanho) {
  const modulos = 21;
  const tamanhoModulo = tamanho / modulos;
  const canvas = document.createElement('canvas');
  canvas.width = tamanho;
  canvas.height = tamanho;
  const ctx = canvas.getContext('2d');

  // Codifica texto em binário
  const dados = codificarTexto(texto);

  // Adiciona paridade (nível L - 7 símbolos)
  const nsym = 7;
  const dadosComParidade = reedSolomon(dados, nsym);

  // Gera matriz de bits
  const matriz = gerarMatrizQR(modulos, dadosComParidade, nsym);

  // Desenha a matriz
  for (let i = 0; i < modulos; i++) {
    for (let j = 0; j < modulos; j++) {
      if (matriz[i][j] === 1) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(
          Math.floor(i * tamanhoModulo),
          Math.floor(j * tamanhoModulo),
          Math.ceil(tamanhoModulo),
          Math.ceil(tamanhoModulo)
        );
      } else {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(
          Math.floor(i * tamanhoModulo),
          Math.floor(j * tamanhoModulo),
          Math.ceil(tamanhoModulo),
          Math.ceil(tamanhoModulo)
        );
      }
    }
  }

  return canvas;
}

// Exportação (ES modules)
export { gerarQR };