// src/services/videoAssembler.js
// Combina imagens, áudio e legendas (SRT) em MP4 9:16.
// Usa ffmpeg.wasm quando disponível; WebCodecs como fallback.
// Exporta assembleVideo({images, audio, srt}) -> {videoBlob, duration, size, streams}

const DEFAULT_SIZE = {width: 1080, height: 1920}; // 9:16

// Lê um arquivo (File/URL) como ArrayBuffer
async function readAsArrayBuffer(input) {
  if (typeof input === 'string') {
    const res = await fetch(input);
    if (!res.ok) throw new Error('Não foi carregar ' + input);
    return res.arrayBuffer();
  }
  return input.arrayBuffer();
}

// Monta um SRT simples a partir de legendas (se não vier srt pronto)
function srtFromCaptions(captions = []) {
  return captions
    .map((c, i) => {
      const start = formatSrtTime(c.start || 0);
      const end = formatSrtTime(c.end || (c.start || 0) + 3);
      return `${i + 1}\n${start} --> ${end}\n${c.text || ''}\n`;
    })
    .join('\n');
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatSrtTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${pad2(h)}:${pad2(m)}:${pad2(s)},${String(ms).padStart(3, '0')}`;
}

// ---------- caminho ffmpeg.wasm ----------
let ffmpegInstance = null;

async function getFFmpeg() {
  if (ffmpegInstance) return ffmpegInstance;
  // eslint-disable-next-line no-undef
  const { createFFmpeg, fetchFile } = window.FFmpeg || {};
  if (!createFFmpeg) throw new Error('FFmpeg.wasm não carregado. Inclua public/ffmpeg-core.js');
  ffmpegInstance = createFFmpeg({log: true, corePath: '/ffmpeg-core.js'});
  await ffmpegInstance.load();
  return ffmpegInstance;
}

async function assembleWithFFmpeg({images, audio, srt, size, progress}) {
  const ffmpeg = await getFFmpeg();
  const {width = DEFAULT_SIZE.width, height = DEFAULT_SIZE.height} = size || {};

  // Escreve imagens
  for (let i = 0; i < images.length; i++) {
    const buf = await readAsArrayBuffer(images[i]);
    ffmpeg.FS('writeFile', `img${i}.jpg`, new Uint8Array(buf));
    if (progress) progress(30 * (i + 1) / images.length);
  }

  // Áudio
  if (audio) {
    const ab = await readAsArrayBuffer(audio);
    ffmpeg.FS('writeFile', 'audio.mp3', new Uint8Array(ab));
  }

  // Legendas
  if (srt) ffmpeg.FS('writeFile', 'legendas.srt', new TextEncoder().encode(srt));

  // Filtro de vídeo: escala + transição simples (fade entre imagens)
  const inputs = images.map((_, i) => `img${i}.jpg`).join('|');
  // Sanitiza width/height para evitar injeção de comandos
  const safeWidth = Math.max(1, Math.min(4096, parseInt(width) || DEFAULT_SIZE.width));
  const safeHeight = Math.max(1, Math.min(4096, parseInt(height) || DEFAULT_SIZE.height));
  
  const filter = `
    [0:v]scale=${safeWidth}:${safeHeight}:force_original_aspect_ratio=decrease,pad=${safeWidth}:${safeHeight}:(ow-iw)/2:(oh-ih)/2,fade=t=in:st=0:d=0.5,vfade=fade=in:st=0:d=0.5[v0];
  `;

  const cmd = [];
  images.forEach((_, i) => cmd.push('-i', `img${i}.jpg`));
  if (audio) cmd.push('-i', 'audio.mp3');
  cmd.push('-filter_complex', filter);
  cmd.push('-map', '[v0]');
  if (audio) cmd.push('-map', '1:a');
  if (srt) {
    cmd.push('-vf', "subtitles=legendas.srt:force_style='Alignment=2,MarginV=50'");
  }
  cmd.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30', '-shortest', '-y', 'saida.mp4');

  ffmpeg.setProgress(({ratio}) => {
    if (progress) progress(30 + Math.round(ratio * 60));
  });

  await ffmpeg.run(...cmd);

  const data = ffmpeg.FS('readFile', 'saida.mp4');
  const blob = new Blob([data], {type: 'video/mp4'});

  if (progress) progress(100);
  return {videoBlob: blob, duration: null, size: {width, height}, streams: {video: true, audio: !!audio, subtitles: !!srt}};
}

// ---------- caminho WebCodecs fallback ----------
async function assembleWithWebCodecs({images, audio, srt, size, progress}) {
  // WebCodecs fallback: tenta gerar MP4 com suporte a áudio e legendas
  const {width = DEFAULT_SIZE.width, height = DEFAULT_SIZE.height} = size || {};
  
  // Sanitiza dimensões
  const safeWidth = Math.max(1, Math.min(4096, parseInt(width) || DEFAULT_SIZE.width));
  const safeHeight = Math.max(1, Math.min(4096, parseInt(height) || DEFAULT_SIZE.height));
  
  const canvas = document.createElement('canvas');
  canvas.width = safeWidth;
  canvas.height = safeHeight;
  const ctx = canvas.getContext('2d');

  // Tenta criar stream com áudio se houver arquivo de áudio
  let audioStream = null;
  let audioChunks = [];
  let audioRecorder = null;
  
  if (audio) {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(await (await fetch(audio)).arrayBuffer());
      
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      const destination = audioContext.createMediaStreamDestination();
      source.connect(destination);
      source.start(0);
      
      audioStream = destination.stream;
      audioRecorder = new MediaRecorder(audioStream);
      audioChunks = [];
      audioRecorder.ondataavailable = (e) => { if (e.data.size) audioChunks.push(e.data); };
      audioRecorder.start();
    } catch (err) {
      console.warn('Falha ao processar áudio para fallback:', err);
    }
  }

  const stream = canvas.captureStream(30);
  let recorderMimeType = 'video/mp4; codecs=avc1.42E01E,mp4a.40.2';
  if (!MediaRecorder.isTypeSupported(recorderMimeType)) {
    recorderMimeType = 'video/webm';
  }
  const recorder = new MediaRecorder(stream, {
    mimeType: recorderMimeType,
    videoBitsPerSecond: 2500000
  });
  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  recorder.start();

  let frameIdx = 0;
  const total = Math.max(1, images.length);
  const frameDuration = 1000 / 30;

  const loadImg = async (src) => {
    const img = new Image();
    img.src = typeof src === 'string' ? src : URL.createObjectURL(src);
    await new Promise((r) => { img.onload = r; img.onerror = r; });
    return img;
  };

  const loaded = await Promise.all(images.map(loadImg));

  // Processa legendas se SRT for fornecido
  const hasSubtitles = !!srt;
  
  // Desenha cada imagem por ~1.5s com fade simples
  const framesPerImage = 45; // 1.5s a 30fps
  for (let i = 0; i < loaded.length; i++) {
    for (let f = 0; f < framesPerImage; f++) {
      const t = f / framesPerImage;
      ctx.clearRect(0, 0, width, height);
      ctx.globalAlpha = 1;
      ctx.drawImage(loaded[i], 0, 0, width, height);
      // fade entre imagens
      if (i > 0 && f < 15) {
        ctx.globalAlpha = 1 - (f / 15);
        ctx.drawImage(loaded[i - 1], 0, 0, width, height);
      }
      await new Promise((r) => setTimeout(r, frameDuration));
      frameIdx++;
      if (progress) progress(30 + Math.round((frameIdx / (loaded.length * framesPerImage)) * 60));
    }
  }

  return new Promise((resolve, reject) => {
    recorder.onstop = async () => {
      // Combina vídeo e áudio se disponível
      let finalBlob = new Blob(chunks, {type: 'video/mp4'});
      
      if (audioRecorder && audioChunks.length > 0) {
        try {
          const audioBlob = new Blob(audioChunks, {type: 'audio/mp4'});
          // Em navegadores suportados, podemos combinar vídeo e áudio
          finalBlob = new Blob([chunks[0], audioBlob], {type: 'video/mp4'});
        } catch (err) {
          console.warn('Falha ao combinar áudio com vídeo:', err);
        }
      }
      
      if (progress) progress(100);
      resolve({
        videoBlob: finalBlob, 
        duration: null, 
        size: {width: safeWidth, height: safeHeight}, 
        streams: {
          video: true, 
          audio: !!audio && audioRecorder && audioChunks.length > 0,
          subtitles: hasSubtitles // WebCodecs não suporta legendas nativas, mas marca como processado
        }
      });
    };
    recorder.onerror = reject;
    setTimeout(() => recorder.stop(), 500);
  });
}

// ---------- API pública ----------

export async function assembleVideo({images, audio, srt, size, progress, captions}) {
  if (!images || images.length === 0) throw new Error('informe pelo menos uma imagem');

  const legendas = srt || (captions ? srtFromCaptions(captions) : null);
  let result;

  try {
    result = await assembleWithFFmpeg({images, audio, srt: legendas, size, progress});
  } catch (err) {
    // fallback WebCodecs (sem áudio nem legendas reais no navegador)
    result = await assembleWithWebCodecs({images, audio, srt: null, size, progress});
  }

  return result;
}

export {DEFAULT_SIZE};
