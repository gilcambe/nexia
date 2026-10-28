import { generateImages, generateSRT } from '../src/services/imageGenerator.js';
import { mockFluxWorker } from '../src/services/fluxWorker.mock.js';

// Mock do fluxWorker para simular a API de geração de imagens
jest.mock('../src/services/fluxWorker.js', () => ({
  generateImage: jest.fn()
}));

const mockGenerateImage = require('../src/services/fluxWorker.js').generateImage;

/**
 * Teste para generateImages(scenes)
 */
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

    const result = await generateImages(scenes);

    // Verificar que retornou um array de blobs/URLs
    expect(result).toBeInstanceOf(Array);
    expect(result.length).toBeGreaterThan(0);

    // Verificar que cada imagem é uma URL válida
    result.forEach(url => {
      expect(typeof url).toBe('string');
      expect(url).toMatch(/^https?:\/\//);
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

    await expect(generateImages(scenes)).rejects.toThrow('API de geração de imagens indisponível');
  });

  test('deve retornar array vazio se scenes estiver vazio', async () => {
    const result = await generateImages([]);
    expect(result).toEqual([]);
  });
});

/**
 * Teste para generateSRT(scenes)
 */
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

  test('deve lidar com erro ao gerar SRT', () => {
    const scenes = null;

    expect(() => generateSRT(scenes)).toThrow();
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
    expect(result).toMatch(/1\s*-->\s*[0-9:]+\.[0-9]+\s*$/m);
    expect(result).toContain('Bom dia, mundo!');

    // Verificar que o timestamp 2 está correto
    expect(result).toMatch(/2\s*-->\s*[0-9:]+\.[0-9]+\s*$/m);
    expect(result).toContain('Que dia lindo!');
  });
});
