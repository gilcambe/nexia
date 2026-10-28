const runtime = require('../../nexia-ai/orchestrator/runtime');
const providers = require('../__mocks__/providers');
const cota = require('../__mocks__/cota');

jest.mock('../../nexia-ai/orchestrator/runtime');
jest.mock('../__mocks__/providers');
jest.mock('../__mocks__/cota');

describe('Runtime Resgate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deve usar modelo maior quando o normal falha', async () => {
    // Configurar mocks
    providers.nvidia.chat.mockImplementationOnce(() => {
      throw new Error('Falha no modelo normal');
    });
    providers.gemini.chat.mockResolvedValue({ resposta: 'Resposta do modelo maior' });
    cota.disponivel.mockReturnValue(true);
    cota.consumir.mockResolvedValue(true);

    // Executar
    const resultado = await runtime.executar({ modelo: 'nvidia', prompt: 'Teste' });

    // Verificar
    expect(providers.nvidia.chat).toHaveBeenCalled();
    expect(providers.gemini.chat).toHaveBeenCalled();
    expect(resultado.resolvidoPor).toBe('gemini');
    expect(resultado.resposta).toBe('Resposta do modelo maior');
  });

  it('deve criar issue quando todas as tentativas falham e cotas disponíveis', async () => {
    // Configurar mocks
    providers.nvidia.chat.mockImplementationOnce(() => {
      throw new Error('Falha no modelo normal');
    });
    providers.gemini.chat.mockImplementationOnce(() => {
      throw new Error('Falha no modelo maior');
    });
    cota.disponivel.mockReturnValue(true);
    cota.consumir.mockResolvedValue(true);
    runtime.criarIssue.mockResolvedValue(true);

    // Executar
    const resultado = await runtime.executar({ modelo: 'nvidia', prompt: 'Teste' });

    // Verificar
    expect(providers.nvidia.chat).toHaveBeenCalled();
    expect(providers.gemini.chat).toHaveBeenCalled();
    expect(runtime.criarIssue).toHaveBeenCalled();
    expect(resultado.resolvidoPor).toBe('issue');
  });

  it('deve falhar quando todas as tentativas falham e cotas esgotadas', async () => {
    // Configurar mocks
    providers.nvidia.chat.mockImplementationOnce(() => {
      throw new Error('Falha no modelo normal');
    });
    providers.gemini.chat.mockImplementationOnce(() => {
      throw new Error('Falha no modelo maior');
    });
    cota.disponivel.mockReturnValue(false);

    // Executar e verificar
    await expect(runtime.executar({ modelo: 'nvidia', prompt: 'Teste' }))
      .rejects.toThrow('Falha no modelo normal');
    expect(providers.nvidia.chat).toHaveBeenCalled();
    expect(providers.gemini.chat).toHaveBeenCalled();
    expect(cota.disponivel).toHaveBeenCalled();
    expect(runtime.criarIssue).not.toHaveBeenCalled();
  });
});
