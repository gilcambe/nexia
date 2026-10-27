const { montarPedidoLicao, verificarDuplicidade } = require('../nexia-ai/orchestrator/licoes');
const { listFor } = require('../nexia-ai/orchestrator');

// Mock do listFor
jest.mock('../nexia-ai/orchestrator', () => ({
  ...jest.requireActual('../nexia-ai/orchestrator'),
  listFor: jest.fn()
}));

// Mock da API de criação de issues
const mockCreateIssue = jest.fn();
jest.mock('../github-adapter', () => ({
  createIssue: mockCreateIssue
}));

describe('montarPedidoLicao', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('deve gerar prompt correto a partir de issue e PR', () => {
    const issue = {
      title: 'Adicionar validação de e-mail',
      body: 'Preciso de uma validação de e-mail no formulário de cadastro',
      number: 123
    };

    const pr = {
      title: 'Implementar validação de e-mail',
      body: 'Adicionei validação de e-mail usando regex',
      number: 456
    };

    const promptEsperado = `Crie uma lição sobre:

Título: Adicionar validação de e-mail
Descrição: Preciso de uma e-mail no formulário de cadastro

PR: Implementar validação de e-mail
Descrição: Adicionei validação de e-mail usando regex`;

    const resultado = montarPedidoLicao(issue, pr);
    expect(resultado).toBe(promptEsperado);
  });

  test('deve lidar com issue sem PR', () => {
    const issue = {
      title: 'Adicionar validação de e-mail',
      body: 'Preciso de uma validação de e-mail no formulário de cadastro',
      number: 123
    };

    const promptEsperado = `Crie uma lição sobre:

Título: Adicionar validação de e-mail
Descrição: Preciso de uma e-mail no formulário de cadastro`;

    const resultado = montarPedidoLicao(issue, null);
    expect(resultado).toBe(promptEsperado);
  });

  test('deve lidar com PR sem issue', () => {
    const pr = {
      title: 'Implementar validação de e-mail',
      body: 'Adicionei validação de e-mail usando regex',
      number: 456
    };

    const promptEsperado = `Crie uma lição sobre:

PR: Implementar validação de e-mail
Descrição: Adicionei validação de e-mail usando regex`;

    const resultado = montarPedidoLicao(null, pr);
    expect(resultado).toBe(promptEsperado);
  });
});

describe('verificarDuplicidade', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('deve rejeitar frase com 60% de palavras em comum', () => {
    const fraseNova = 'validação de e-mail no formulário de cadastro';
    const licoesExistentes = [
      'validação de e-mail no formulário de login',
      'senha forte para segurança',
      'autenticação de dois fatores'
    ];

    listFor.mockReturnValue({ fast: licoesExistentes });

    const resultado = verificarDuplicidade(fraseNova);
    expect(resultado).toBe(false);
  });

  test('deve rejeitar frase com mais de 60% de palavras em comum', () => {
    const fraseNova = 'validação de e-mail no formulário de cadastro completo';
    const licoesExistentes = [
      'validação de e-mail no formulário de login',
      'senha forte para segurança',
      'autenticação de dois fatores'
    ];

    listFor.mockReturnValue({ fast: licoesExistentes });

    const resultado = verificarDuplicidade(fraseNova);
    expect(resultado).toBe(false);
  });

  test('deve aceitar frase com menos de 60% de palavras em comum', () => {
    const fraseNova = 'autenticação biométrica no celular';
    const licoesExistentes = [
      'validação de e-mail no formulário de login',
      'senha forte para segurança',
      'autenticação de dois fatores'
    ];

    listFor.mockReturnValue({ fast: licoesExistentes });

    const resultado = verificarDuplicidade(fraseNova);
    expect(resultado).toBe(true);
  });

  test('deve aceitar frase completamente diferente', () => {
    const fraseNova = 'implementação de chatbot para atendimento';
    const licoesExistentes = [
      'validação de e-mail no formulário de login',
      'senha forte para segurança',
      'autenticação de dois fatores'
    ];

    listFor.mockReturnValue({ fast: licoesExistentes });

    const resultado = verificarDuplicidade(fraseNova);
    expect(resultado).toBe(true);
  });

  test('deve lidar com array vazio de lições existentes', () => {
    const fraseNova = 'validação de e-mail no formulário de cadastro';
    const licoesExistentes = [];

    listFor.mockReturnValue({ fast: licoesExistentes });

    const resultado = verificarDuplicidade(fraseNova);
    expect(resultado).toBe(true);
  });
});

// Teste de integração completo
describe('Integração: montagem e verificação de lição', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('deve criar lição se não houver duplicidade', async () => {
    const issue = {
      title: 'Adicionar validação de e-mail',
      body: 'Preciso de uma validação de e-mail no formulário de cadastro',
      number: 123
    };

    const pr = {
      title: 'Implementar validação de e-mail',
      body: 'Adicionei validação de e-mail usando regex',
      number: 456
    };

    const licoesExistentes = [
      'senha forte para segurança',
      'autenticação de dois fatores'
    ];

    listFor.mockReturnValue({ fast: licoesExistentes });
    mockCreateIssue.mockResolvedValue({ number: 789 });

    const prompt = montarPedidoLicao(issue, pr);
    const podeCriar = verificarDuplicidade(prompt);

    expect(podeCriar).toBe(true);
    expect(mockCreateIssue).toHaveBeenCalledWith({
      title: 'Lição: Adicionar validação de e-mail',
      body: expect.stringContaining('Crie uma lição sobre:'),
      labels: ['lição']
    });
  });

  test('não deve criar lição se houver duplicidade', async () => {
    const issue = {
      title: 'Adicionar validação de e-mail',
      body: 'Preciso de uma validação de e-mail no formulário de cadastro',
      number: 123
    };

    const pr = {
      title: 'Implementar validação de e-mail',
      body: 'Adicionei validação de e-mail usando regex',
      number: 456
    };

    const licoesExistentes = [
      'validação de e-mail no formulário de cadastro',
      'senha forte para segurança'
    ];

    listFor.mockReturnValue({ fast: licoesExistentes });
    mockCreateIssue.mockResolvedValue({ number: 789 });

    const prompt = montarPedidoLicao(issue, pr);
    const podeCriar = verificarDuplicidade(prompt);

    expect(podeCriar).toBe(false);
    expect(mockCreateIssue).not.toHaveBeenCalled();
  });
});
