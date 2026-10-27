// src/__tests__/videoAssembler.test.js
// Testes de aceitação para videoAssembler

import { assembleVideo, DEFAULT_SIZE } from '../services/videoAssembler.js';

describe('videoAssembler', () => {
  const imagensTeste = [
    new Blob(['test image data'], {type: 'image/jpeg'}),
    new Blob(['test image data 2'], {type: 'image/jpeg'})
  ];
  
  const audioTeste = new Blob(['test audio data'], {type: 'audio/mpeg'});
  
  const srtTeste = `1
00:00:00,000 --> 00:00:03,000
Primeira legenda

2
00:00:03,000 --> 00:00:06,000
Segunda legenda
`;

  beforeEach(() => {
    // Limpa qualquer instância anterior do ffmpeg
    if (window.FFmpeg) {
      delete window.FFmpeg;
    }
  });

  test('deve gerar vídeo de ~5s com ffmpeg.wasm', async () => {
    // Mock do FFmpeg para evitar dependência externa
    window.FFmpeg = {
      createFFmpeg: () => ({
        load: jest.fn().mockResolvedValue(),
        FS: {
          writeFile: jest.fn(),
          readFile: jest.fn().mockReturnValue(new Uint8Array([1, 2, 3]))
        },
        run: jest.fn().mockResolvedValue(),
        setProgress: jest.fn(),
        log: true,
        corePath: '/ffmpeg-core.js'
      })
    };

    const progress = jest.fn();
    const resultado = await assembleVideo({
      images: imagensTeste,
      audio: audioTeste,
      srt: srtTeste,
      progress
    });

    expect(resultado.videoBlob).toBeInstanceOf(Blob);
    expect(resultado.videoBlob.type).toBe('video/mp4');
    expect(resultado.streams.video).toBe(true);
    expect(resultado.streams.audio).toBe(true);
    expect(resultado.streams.subtitles).toBe(true);
    expect(resultado.size).toEqual(DEFAULT_SIZE);
    
    // Verifica que o progresso foi chamado
    expect(progress).toHaveBeenCalledTimes(imagensTeste.length + 2); // +2 para progresso do ffmpeg e final
  }, 10000);

  test('deve gerar vídeo com fallback WebCodecs quando ffmpeg não está disponível', async () => {
    // Não carrega FFmpeg
    delete window.FFmpeg;

    const progress = jest.fn();
    const resultado = await assembleVideo({
      images: imagensTeste,
      audio: audioTeste,
      srt: srtTeste,
      progress
    });

    expect(resultado.videoBlob).toBeInstanceOf(Blob);
    // WebCodecs gera WebM como fallback
    expect(resultado.videoBlob.type).toBe('video/webm');
    expect(resultado.streams.video).toBe(true);
    expect(resultado.streams.audio).toBe(false); // WebCodecs não suporta áudio no fallback
    expect(resultado.streams.subtitles).toBe(false); // WebCodecs não suporta legendas no fallback
    expect(resultado.size).toEqual(DEFAULT_SIZE);
    
    // Verifica que o progresso foi chamado
    expect(progress).toHaveBeenCalled();
  }, 10000);

  test('deve validar parâmetros de tamanho', async () => {
    window.FFmpeg = {
      createFFmpeg: () => ({
        load: jest.fn().mockResolvedValue(),
        FS: {
          writeFile: jest.fn(),
          readFile: jest.fn().mockReturnValue(new Uint8Array([1, 2, 3]))
        },
        run: jest.fn().mockResolvedValue(),
        setProgress: jest.fn(),
        log: true,
        corePath: '/ffmpeg-core.js'
      })
    };

    // Testa tamanho personalizado
    const tamanhoCustom = {width: 720, height: 1280};
    const resultado = await assembleVideo({
      images: imagensTeste,
      size: tamanhoCustom
    });

    expect(resultado.size).toEqual(tamanhoCustom);
  });

  test('deve gerar erro com imagens vazias', async () => {
    await expect(assembleVideo({images: []})).rejects.toThrow('informe pelo menos uma imagem');
  });

  test('deve gerar SRT a partir de captions se srt não for fornecido', async () => {
    window.FFmpeg = {
      createFFmpeg: () => ({
        load: jest.fn().mockResolvedValue(),
        FS: {
          writeFile: jest.fn(),
          readFile: jest.fn().mockReturnValue(new Uint8Array([1, 2, 3]))
        },
        run: jest.fn().mockResolvedValue(),
        setProgress: jest.fn(),
        log: true,
        corePath: '/ffmpeg-core.js'
      })
    };

    const captions = [
      {start: 0, end: 3, text: 'Legenda 1'},
      {start: 3, end: 6, text: 'Legenda 2'}
    ];

    const resultado = await assembleVideo({
      images: imagensTeste,
      captions
    });

    expect(resultado.videoBlob).toBeInstanceOf(Blob);
    expect(resultado.streams.subtitles).toBe(true);
  });
});
