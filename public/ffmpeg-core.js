// public/ffmpeg-core.js
// Configuração do ffmpeg.wasm para uso no navegador
// Deve ser carregado antes de usar videoAssembler.js

(function() {
  'use strict';
  
  // Carrega os scripts necessários do ffmpeg.wasm
  if (typeof window !== 'undefined') {
    // Verifica se já foi carregado
    if (window.FFmpeg) return;
    
    // URLs dos arquivos do ffmpeg.wasm
    const ffmpegCoreUrl = '/ffmpeg-core.js';
    const ffmpegWasmUrl = '/ffmpeg-core.wasm';
    
    // Configuração global
    window.FFmpegConfig = {
      corePath: ffmpegCoreUrl,
      wasmPath: ffmpegWasmUrl,
      log: true
    };
    
    // Carrega o script principal do ffmpeg.wasm
    const script = document.createElement('script');
    script.src = ffmpegCoreUrl;
    script.async = true;
    script.onload = function() {
      console.log('FFmpeg.wasm carregado com sucesso');
    };
    script.onerror = function() {
      console.error('Falha ao carregar FFmpeg.wasm');
    };
    
    // Adiciona ao head se não existir
    if (!document.querySelector(`script[src="${ffmpegCoreUrl}"]`)) {
      document.head.appendChild(script);
    }
  }
})();
