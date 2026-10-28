import { v4 as uuidv4 } from 'uuid';
import { isUrl } from '../utils/urlValidator.js';

/**
 * Gerador de imagens por cena do roteiro.
 * Recebe um array de cenas e gera 3-5 imagens por cena usando a API existente.
 *
 * @param {Array<Object>} scenes - Array de cenas com { id, prompt, duration, start, end }
 * @param {Object} fluxWorker - Objeto com método generateImage(prompt, aspectRatio)
 * @param {number} imagesPerScene - Número de imagens por cena (padrão: 5)
 * @returns {Promise<Array<Blob>>} - Array de blobs das imagens geradas
 */
export async function generateImages(scenes, fluxWorker, imagesPerScene = 5) {
  if (!Array.isArray(scenes) || scenes.length === 0) {
    throw new Error('scenes deve ser um array não vazio');
  }

  if (!fluxWorker || typeof fluxWorker.generateImage !== 'function') {
    throw new Error('fluxWorker não está disponível ou não tem método generateImage');
  }

  const allImages = [];

  // Formatos de aspecto suportados
  const aspectRatios = ['square', '9:16', '16:9'];

  // Função auxiliar para validar e converter URL para Blob
  async function fetchImageAsBlob(url) {
    if (!url || !isUrl(url)) {
      throw new Error(`URL inválida: ${url}`);
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Falha ao baixar imagem: ${response.status} ${response.statusText}`);
      }
      return await response.blob();
    } catch (error) {
      throw new Error(`Erro ao baixar imagem: ${error.message}`);
    }
  }

  for (const scene of scenes) {
    const sceneId = scene.id || uuidv4();
    const scenePrompt = scene.prompt || 'Image';

    // Gerar 3-5 imagens por cena
    const count = Math.min(imagesPerScene, 5);

    for (let i = 0; i < count; i++) {
      // Seleciona formato aleatório ou fixo
      const aspectRatio = aspectRatios[i % aspectRatios.length];

      // Gera imagem usando a API existente
      const imageUrl = await fluxWorker.generateImage(scenePrompt, aspectRatio);

      if (!imageUrl) {
        throw new Error(`Falha ao gerar imagem para cena ${sceneId}`);
      }

      // Converte URL para Blob com validação de segurança
      const imageBlob = await fetchImageAsBlob(imageUrl);

      allImages.push({
        id: uuidv4(),
        sceneId,
        sceneIndex: scenes.indexOf(scene),
        prompt: scenePrompt,
        aspectRatio,
        url: imageUrl,
        blob: imageBlob,
        index: i
      });

      // O array allImages contém objetos com { id, sceneId, sceneIndex, prompt, aspectRatio, url, blob, index }
    }
  }

  return allImages;
}

/**
 * Gera imagens em lote (para testes).
 * @param {Object} fluxWorker - Objeto com método generateImage(prompt, aspectRatio)
 * @returns {Promise<Array>} - Array de objetos com { id, sceneId, sceneIndex, prompt, aspectRatio, url, blob, index }
 */
export async function generateImagesBatch(fluxWorker) {
  const scenes = [
    { id: 'scene-1', prompt: 'A sunny beach at sunset', duration: 10, start: 0, end: 10 },
    { id: 'scene-2', prompt: 'A city skyline at night', duration: 8, start: 10, end: 18 },
    { id: 'scene-3', prompt: 'A forest path in autumn', duration: 12, start: 18, end: 30 }
  ];

  return generateImages(scenes, fluxWorker, 3);
}
