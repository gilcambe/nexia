import { pipeline } from '@xenova/transformers';

let whisper;

export async function loadWhisper() {
  if (!whisper) {
    whisper = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');
  }
  return whisper;
}

export async function transcribeAudio(audioBlob) {
  try {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioContext = new AudioContext();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Convert to mono if needed
    let audioData;
    if (audioBuffer.numberOfChannels === 2) {
      const left = audioBuffer.getChannelData(0);
      const right = audioBuffer.getChannelData(1);
      audioData = new Float32Array(left.length);
      for (let i = 0; i < left.length; i++) {
        audioData[i] = (left[i] + right[i]) / 2;
      }
    } else {
      audioData = audioBuffer.getChannelData(0);
    }

    const model = await loadWhisper();
    const result = await model(audioData, {
      top_k: 0,
      do_sample: false,
      chunk_length_s: 30,
      stride_length_s: 5,
    });

    return result.text;
  } catch (error) {
    console.error('Error in transcription:', error);
    throw error;
  }
}
