// public/ffmpeg-core.js
// Carrega o SDK real do ffmpeg.wasm de CDN grátis e expõe window.FFmpeg.
// Deve ser carregado antes de usar videoAssembler.js.

(function () {
  'use strict';
  if (window.FFmpeg) return;

  const FFMPEG_VERSION = '0.12.1';

  async function load() {
    const [ffmpegMod, utilMod] = await Promise.all([
      import(`https://esm.sh/@ffmpeg/ffmpeg@${FFMPEG_VERSION}`),
      import(`https://esm.sh/@ffmpeg/util@${FFMPEG_VERSION}`)
    ]);
    window.FFmpeg = {
      createFFmpeg: ffmpegMod.createFFmpeg,
      fetchFile: utilMod.fetchFile
    };
  }

  load().catch((err) => {
    console.error('Falha ao carregar ffmpeg.wasm do CDN:', err);
  });
})();
