/*
 * Mock do fluxWorker para testes de generateImages.
 * Simula o objeto fluxWorker usado pelo componente ChatImageGenerator.
 */
export const mockFluxWorker = {
  generateImage: jest.fn().mockResolvedValue('https://example.com/mock-image.jpg')
};

export default mockFluxWorker;
