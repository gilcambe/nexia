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
  return await response.blob();
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

  return new Blob(blobs, { type: 'audio/mpeg' });
}
