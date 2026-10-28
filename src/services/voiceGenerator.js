const TTS_API_URL = process.env.NEXIA_TTS_API_URL || '/api/tts';

async function fetchAudio(text) {
  const response = await fetch(`${TTS_API_URL}?text=${encodeURIComponent(text)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) {
    throw new Error(`TTS API error: ${response.status}`);
  }
  const audioBlob = await response.blob();
  
  // Verificar se o blob tem conteúdo
  if (audioBlob.size === 0) {
    throw new Error('API TTS retornou áudio vazio');
  }
  
  return audioBlob;
}

/**
 * Converte o texto de cada cena em áudio usando a API TTS existente,
 * retornando um blob de áudio concatenado.
 * @param {Array<{text: string}|string>} scenes - Lista de cenas com texto.
 * @returns {Promise<Blob>} Blob de áudio concatenado.
 */
export async function generateVoice(scenes) {
  if (!Array.isArray(scenes) || scenes.length === 0) {
    throw new Error('scenes deve ser um array não vazio');
  }

  const blobs = [];
  for (const scene of scenes) {
    const text = typeof scene === 'string' ? scene : scene.text;
    if (!text) {
      throw new Error('Cada cena deve ter texto');
    }
    const blob = await fetchAudio(text);
    blobs.push(blob);
  }

  // Concatenar blobs de áudio
  const audioBuffers = [];
  for (const blob of blobs) {
    const arrayBuffer = await blob.arrayBuffer();
    audioBuffers.push(arrayBuffer);
  }
  
  // Criar um novo blob concatenado
  return new Blob(audioBuffers, { type: 'audio/mpeg' });
}
