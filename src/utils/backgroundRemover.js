/**
 * Utilitário para remoção de fundo de imagens carregadas no navegador.
 * Utiliza TensorFlow.js e o modelo BodyPix para segmentação e manipulação de canvas.
 * Exporta removeBackground(file, bgColor) que retorna um Blob da imagem processada.
 */

import * as tf from '@tensorflow/tfjs';
import * as bodyPix from '@tensorflow-models/body-pix';

let modelPromise = null;

async function loadBodyPixModel() {
  if (!modelPromise) {
    // Garante que o backend do TensorFlow.js está inicializado
    await tf.ready();
    modelPromise = bodyPix.load({
      architecture: 'MobileNetV1',
      outputStride: 16,
      multiplier: 0.75,
      quantBytes: 2
    });
  }
  return modelPromise;
}

/**
 * Remove o fundo de uma imagem carregada (File ou Blob) e retorna um Blob PNG.
 * @param {File|Blob} file - A imagem de entrada.
 * @param {string|null} bgColor - 'white', 'transparent', uma cor CSS (ex: '#ffffff', 'rgba(0,0,0,0)') ou null para transparente.
 * @returns {Promise<Blob>} - Blob da imagem PNG processada.
 */
export async function removeBackground(file, bgColor = 'white') {
  if (!file) {
    throw new Error('Nenhum arquivo de imagem fornecido.');
  }

  // 1. Carregar a imagem em um elemento Image
  const imageUrl = URL.createObjectURL(file);
  const img = new Image();
  img.crossOrigin = 'anonymous';

  const imageLoaded = new Promise((resolve, reject) => {
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error('Falha ao carregar a imagem: ' + err));
  });

  img.src = imageUrl;
  await imageLoaded;

  try {
    // 2. Carregar o modelo BodyPix
    const net = await loadBodyPixModel();

    // 3. Estimar a segmentação da pessoa/objeto na imagem
    // Segment person / segmentation person
    const segmentation = await net.segmentPerson(img, {
      internalResolution: 'medium',
      segmentationThreshold: 0.7,
      maxDetections: 1,
      scoreThreshold: 0.4
    });

    // 4. Criar canvas com as dimensões originais da imagem
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Desenhar a imagem original no canvas temporariamente para leitura dos pixels
    ctx.drawImage(img, 0, 0, width, height);
    const imgData = ctx.getImageData(0, 0, width, height);
    const pixels = imgData.data;

    const { data: backgroundMask } = segmentation;

    // 5. Processar os pixels com base na máscara do BodyPix
    for (let i = 0; i < backgroundMask.length; i++) {
      // backgroundMask[i] é 1 se pertencesse ao corpo/objeto segmentado, 0 caso contrário.
      // Ajuste para isolar o primeiro plano (foreground)
      const isForeground = backgroundMask[i] === 1;
      const offset = i * 4;

      if (!isForeground) {
        if (bgColor === 'white') {
          pixels[offset] = 255;     // R
          pixels[offset + 1] = 255; // G
          pixels[offset + 2] = 255; // B
          pixels[offset + 3] = 255; // A (opaco)
        } else if (bgColor && bgColor !== 'transparent') {
          // Se for uma cor customizada, podemos desenhar por cima ou manipular se necessário.
          // Para simplicidade com cores customizadas, tratamos abaixo no contexto do canvas,
          // mas aqui aplicamos transparência por padrão.
          pixels[offset + 3] = 0;   // Transparente
        } else {
          pixels[offset + 3] = 0;   // Transparente
        }
      }
    }

    // Atualizar pixels no canvas com o recorte limpo
    ctx.putImageData(imgData, 0, 0);

    // Se foi passada uma cor customizada (que não seja branco nem transparente), preenchemos o fundo via composição
    if (bgColor && bgColor !== 'white' && bgColor !== 'transparent') {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      tempCanvas.height = height;
      const tempCtx = tempCanvas.getContext('2d');
      
      // Preencher com a cor de fundo desejada
      tempCtx.fillStyle = bgColor;
      tempCtx.fillRect(0, 0, width, height);
      
      // Desenhar a imagem recortada por cima
      tempCtx.drawImage(canvas, 0, 0);
      
      // Copiar de volta para o canvas principal
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(tempCanvas, 0, 0);
    }

    // 6. Converter o canvas em Blob (image/png)
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Falha ao gerar o Blob da imagem processada.'));
        }
      }, 'image/png');
    });

  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}
