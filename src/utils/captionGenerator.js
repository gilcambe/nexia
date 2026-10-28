/**
 * Generates SRT captions for each scene in the script.
 * @param {Array} scenes - Array of scenes, each containing a description and dialogue.
 * @returns {string} - SRT formatted string.
 */
export function generateSRT(scenes) {
  let srtContent = '';
  let index = 1;
  let time = 0;

  for (const scene of scenes) {
    for (const dialogue of scene.dialogue) {
      const startTime = formatTime(time);
      time += dialogue.duration || 2; // Default duration is 2 seconds if not specified
      const endTime = formatTime(time);

      srtContent += `${index}\n${startTime} --> ${endTime}\n${dialogue.text}\n\n`;
      index++;
    }
  }

  return srtContent;
}

/**
 * Formats time in HH:MM:SS,mmm format.
 * @param {number} seconds - Time in seconds.
 * @returns {string} - Formatted time string.
 */
function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);

  return `${pad(hours)}:${pad(minutes)}:${pad(secs)},${pad(millis, 3)}`;
}

/**
 * Pads a number with leading zeros.
 * @param {number} num - Number to pad.
 * @param {number} size - Number of digits.
 * @returns {string} - Padded number string.
 */
function pad(num, size = 2) {
  let s = num.toString();
  while (s.length < size) s = '0' + s;
  return s;
}
