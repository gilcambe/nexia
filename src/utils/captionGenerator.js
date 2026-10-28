/**
 * CaptionGenerator - Utilitário para gerar arquivo SRT a partir de cenas de roteiro.
 *
 * Exporta:
 * - generateSRT(scenes): retorna string SRT completa
 *
 * Cenário de uso:
 * - Recebe array de cenas com { prompt, speech, startTime, endTime, duration } ou { prompt, speech, duration }.
 * - Gera timestamps no formato HH:MM:SS,mmm
 * - Valida que startTime e endTime são números positivos e endTime > startTime
 * - Produz string SRT válida para ser usada em players de vídeo.
 *
 * @param {Array} scenes - Array de objetos de cena.
 * @param {string} scenes[].prompt - Descrição da cena (opcional).
 * @param {string} scenes[].speech - Texto da fala (opcional).
 * @param {number} scenes[].startTime - Timestamp de início (em segundos, opcional). Deve ser positivo.
 * @param {number} scenes[].endTime - Timestamp de fim (em segundos, opcional). Deve ser positivo e > startTime.
 * @param {number} scenes[].duration - Duração da cena (em segundos, opcional).
 * @returns {string} - String SRT formatada.
 */

/**
 * Converte segundos em timestamp SRT (HH:MM:SS,mmm).
 *
 * @param {number} seconds - Tempo em segundos.
 * @returns {string} - Timestamp formatado.
 */
function formatTimestamp(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  const pad = (num) => num.toString().padStart(2, '0');
  const padMs = (num) => num.toString().padStart(3, '0');

  return `${pad(hours)}:${pad(minutes)}:${pad(secs)},${padMs(ms)}`;
}

/**
 * Gera string SRT a partir de um array de cenas.
 *
 * @param {Array} scenes - Array de objetos de cena.
 * @returns {string} - String SRT completa.
 */
export function generateSRT(scenes) {
  if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
    return '';
  }

  return scenes
    .map((scene, index) => {
      const sceneIndex = index + 1;

      // Extrair dados da cena
      const speech = scene.speech || '';
      const prompt = scene.prompt || '';

      // Determinar e validar timestamps
      let startTime = scene.startTime;
      let endTime = scene.endTime;

      // Se não tiver endTime, usa duration (se existir) ou calcula a partir de prompt (exemplo)
      if (endTime === undefined && scene.duration) {
        endTime = startTime + scene.duration;
      } else if (endTime === undefined) {
        // Fallback: se não tiver duration, assume 5 segundos como padrão
        endTime = startTime + 5;
      }

      // Se não tiver startTime, calcula a partir de endTime e duration
      if (startTime === undefined && scene.duration) {
        startTime = endTime - scene.duration;
      } else if (startTime === undefined) {
        // Fallback: usa 0 como início
        startTime = 0;
      }

      // Validar que startTime e endTime são números positivos
      startTime = typeof startTime === 'number' && startTime >= 0 ? startTime : 0;
      endTime = typeof endTime === 'number' && endTime >= 0 ? endTime : 0;

      // Validar que endTime > startTime
      if (endTime <= startTime) {
        endTime = startTime + 5; // Fallback: adiciona 5 segundos se endTime <= startTime
      }

      // Formatar timestamps
      const startStr = formatTimestamp(startTime);
      const endStr = formatTimestamp(endTime);

      // Montar linha de número e timestamps
      let line = `${sceneIndex}\n${startStr} --> ${endStr}`;

      // Adicionar texto da fala
      if (speech) {
        line += `\n${speech}`;
      }

      // Adicionar descrição da cena se houver
      if (prompt && prompt !== speech) {
        line += `\n${prompt}`;
      }

      // Linha em branco para separar legendas
      line += '\n';

      return line;
    })
    .join('');
}
