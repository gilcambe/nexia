import { generateImages } from '../src/services/imageGenerator.js';
import { generateSRT } from '../src/utils/captionGenerator.js';
import { mockFluxWorker } from '../src/services/fluxWorker.mock.js';

// Mock do fluxWorker para simular a API de geração de imagens
jest.mock('../src/services/fluxWorker.js', () => ({
  generateImage: jest.fn()
}));

const mockGenerateImage = require('../src/services/fluxWorker.js').generateImage;

/**
 * Testes para generateImages (src/services/imageGenerator.js)
 */
import { generateImages } from '../src/services/imageGenerator.js';
import { mockFluxWorker } from '../src/services/fluxWorker.mock.js';

// Mock do fluxWorker para simular a API de geração de imagens
jest.mock('../src/services/fluxWorker.js', () => ({
  generateImage: jest.fn()
}));

const mockGenerateImage = require('../src/services/fluxWorker.js').generateImage;

describe('generateImages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('deve gerar 3-5 imagens por cena usando a API existente', async () => {
    // Dados de exemplo de cenas do roteiro
    const scenes = [
      {
        id: 'scene-1',
        prompt: 'Cena 1: Um homem caminhando na praia',
        dialogue: 'Bom dia, mundo!',
        startTime: 0,
        endTime: 5
      },
      {
        id: 'scene-2',
        prompt: 'Cena 2: Uma mulher olhando para o mar',
        dialogue: 'Que dia lindo!',
        startTime: 5,
        endTime: 10
      }
    ];

    // Simular respostas da API de geração de imagens (3-5 por cena)
    mockGenerateImage
      .mockResolvedValueOnce('https://example.com/image1.jpg')
      .mockResolvedValueOnce('https://example.com/image2.jpg')
      .mockResolvedValueOnce('https://example.com/image3.jpg')
      .mockResolvedValueOnce('https://example.com/image4.jpg')
      .mockResolvedValueOnce('https://example.com/image5.jpg')
      .mockResolvedValueOnce('https://example.com/image6.jpg')
      .mockResolvedValueOnce('https://example.com/image7.jpg')
      .mockResolvedValueOnce('https://example.com/image8.jpg')
      .mockResolvedValueOnce('https://example.com/image9.jpg')
      .mockResolvedValueOnce('https://example.com/image10.jpg');

    const result = await generateImages(scenes, mockFluxWorker);

    // Verificar que retornou um array de objetos com imagens
    expect(result).toBeInstanceOf(Array);
    expect(result.length).toBeGreaterThan(0);

    // Verificar que cada imagem é um objeto com as propriedades esperadas
    result.forEach(img => {
      expect(img).toHaveProperty('id');
      expect(img).toHaveProperty('sceneId');
      expect(img).toHaveProperty('sceneIndex');
      expect(img).toHaveProperty('prompt');
      expect(img).toHaveProperty('aspectRatio');
      expect(img).toHaveProperty('url');
      expect(img).toHaveProperty('blob');
      expect(img).toHaveProperty('index');
      expect(img.url).toMatch(/^https?:\/\//);
    });

    // Verificar que a API foi chamada corretamente
    expect(mockGenerateImage).toHaveBeenCalledTimes(10);
    expect(mockGenerateImage).toHaveBeenCalledWith(expect.any(String), expect.any(String));
  });

  test('deve lidar com erro na API de geração de imagens', async () => {
    const scenes = [
      {
        id: 'scene-1',
        prompt: 'Cena 1: Teste',
        dialogue: 'Falando...',
        startTime: 0,
        endTime: 5
      }
    ];

    // Simular erro na API
    mockGenerateImage.mockRejectedValueOnce(new Error('API de geração de imagens indisponível'));

    await expect(generateImages(scenes, mockFluxWorker)).rejects.toThrow('API de geração de imagens indisponível');
  });

  test('deve retornar array vazio se scenes estiver vazio', async () => {
    const result = await generateImages([], mockFluxWorker);
    expect(result).toEqual([]);
  });

  test('deve validar fluxWorker obrigatório', async () => {
    const scenes = [{ id: 'scene-1', prompt: 'Teste' }];
    
    await expect(generateImages(scenes)).rejects.toThrow('fluxWorker não está disponível ou não tem método generateImage');
  });
});

/**
 * Testes para generateSRT (src/utils/captionGenerator.js)
 */
import { generateSRT } from '../src/utils/captionGenerator.js';

describe('generateSRT', () => {
  test('deve gerar string SRT válida com 2 cenas', () => {
    const scenes = [
      {
        id: 'scene-1',
        prompt: 'Cena 1: Um homem caminhando na praia',
        dialogue: 'Bom dia, mundo!',
        startTime: 0,
        endTime: 5
      },
      {
        id: 'scene-2',
        prompt: 'Cena 2: Uma mulher olhando para o mar',
        dialogue: 'Que dia lindo!',
        startTime: 5,
        endTime: 10
      }
    ];

    const result = generateSRT(scenes);

    // Verificar que é uma string
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);

    // Verificar que está no formato SRT válido
    expect(result).toContain('1');
    expect(result).toContain('-->');
    expect(result).toContain('Bom dia, mundo!');
    expect(result).toContain('2');
    expect(result).toContain('-->');
    expect(result).toContain('Que dia lindo!');

    // Verificar que há linha em branco entre cenas
    const lines = result.split('\n');
    const blankLineIndex = lines.findIndex(line => line.trim() === '');
    expect(blankLineIndex).toBeGreaterThan(0);
  });

  test('deve lidar com timestamps inválidos', () => {
    const scenes = [
      {
        id: 'scene-1',
        prompt: 'Cena 1',
        dialogue: 'Falando...',
        startTime: -1, // Timestamp negativo
        endTime: 5
      }
    ];

    // Não deve lançar erro, mas deve corrigir timestamps
    expect(() => generateSRT(scenes)).not.toThrow();
    const result = generateSRT(scenes);
    expect(result).toContain('00:00:00,000 --> 00:00:05,000');
  });

  test('deve validar que endTime > startTime', () => {
    const scenes = [
      {
        id: 'scene-1',
        prompt: 'Cena 1',
        dialogue: 'Falando...',
        startTime: 10,
        endTime: 5 // endTime menor que startTime
      }
    ];

    // Não deve lançar erro, mas deve corrigir timestamps
    expect(() => generateSRT(scenes)).not.toThrow();
    const result = generateSRT(scenes);
    expect(result).toContain('00:00:10,000 --> 00:00:15,000'); // Adiciona 5 segundos
  });

  test('deve retornar string vazia se scenes estiver vazio', () => {
    const result = generateSRT([]);
    expect(result).toBe('');
  });

  test('deve gerar SRT com timestamps corretos', () => {
    const scenes = [
      {
        id: 'scene-1',
        prompt: 'Cena 1',
        dialogue: 'Falando...',
        startTime: 0,
        endTime: 5
      },
      {
        id: 'scene-2',
        prompt: 'Cena 2',
        dialogue: 'Falando mais...',
        startTime: 5,
        endTime: 10
      }
    ];

    const result = generateSRT(scenes);

    // Verificar que o timestamp 1 está correto
    expect(result).toMatch(/1\s*-->\s*00:00:05,000\s*$/m);
    expect(result).toContain('Falando...');

    // Verificar que o timestamp 2 está correto
    expect(result).toMatch(/2\s*-->\s*00:00:10,000\s*$/m);
    expect(result).toContain('Falando mais...');
  });

  test('deve lidar com cenas sem timestamps usando duration', () => {
    const scenes = [
      {
        id: 'scene-1',
        prompt: 'Cena 1',
        dialogue: 'Falando...',
        duration: 5
      }
    ];

    const result = generateSRT(scenes);
    expect(result).toContain('00:00:00,000 --> 00:00:05,000');
  });

  test('deve lidar com cenas sem dados obrigatórios', () => {
    const scenes = [
      {
        id: 'scene-1'
        // sem prompt, speech, startTime, endTime, duration
      }
    ];

    const result = generateSRT(scenes);
    expect(result).toContain('1\n00:00:00,000 --> 00:00:05,000\n');
  });
});
