import { generateImageWithFlux } from './fluxWorker';

// Serviço de fallback para Pollinations AI
export async function generateImageWithPollinations(prompt: string): Promise<{ url: string; format: string }> {
  const encoded = encodeURIComponent(prompt);
  const url = `https://image.pollinations.ai/prompt/${encoded}`;
  return {
    url,
    format: 'image/jpeg'
  };
}

// Função principal solicitada que tenta o FLUX.1 schnell e usa o Pollinations como fallback
export async function generateImage(prompt: string): Promise<{ url: string; format: string }> {
  try {
    return await generateImageWithFlux(prompt);
  } catch (err) {
    // Falha no Workers AI -> aciona fallback do Pollinations
    return await generateImageWithPollinations(prompt);
  }
}

export default generateImage;
