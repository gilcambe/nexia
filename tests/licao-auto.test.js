const { montarPedidoLicao, verificarDuplicidade } = require('../scripts/licao-auto');
const { listFor } = require('../lib/github');
const { criarIssue } = require('../lib/github-api');

jest.mock('../lib/github', () => ({
  listFor: jest.fn(),
}));

jest.mock('../lib/github-api', () => ({
  criarIssue: jest.fn(),
}));

describe('montarPedidoLicao', () => {
  it('deve gerar o prompt correto a partir de issue e PR', () => {
    const issue = {
      title: 'Nova funcionalidade',
      body: 'Descrição da issue',
      number: 1,
    };
    const pr = {
      title: 'PR para nova funcionalidade',
      body: 'Descrição do PR',
      number: 1,
    };

    const prompt = montarPedidoLicao(issue, pr);

    expect(prompt).toContain('Nova funcionalidade');
    expect(prompt).toContain('Descrição da issue');
    expect(prompt).toContain('PR para nova funcionalidade');
    expect(prompt).toContain('Descrição do PR');
  });
});

describe('verificarDuplicidade', () => {
  it('deve rejeitar frases com ≥60% de palavras em comum com lições existentes', async () => {
    const frase = 'Esta é uma frase de teste';
    const licoesExistentes = [
      { body: 'Esta é uma frase de teste' },
      { body: 'Esta é outra frase de teste' },
    ];

    listFor.mockResolvedValue(licoesExistentes);

    const resultado = await verificarDuplicidade(frase);

    expect(resultado).toBe(false);
  });

  it('deve aceitar novas frases', async () => {
    const frase = 'Esta é uma frase nova';
    const licoesExistentes = [
      { body: 'Esta é uma frase de teste' },
      { body: 'Esta é outra frase de teste' },
    ];

    listFor.mockResolvedValue(licoesExistentes);

    const resultado = await verificarDuplicidade(frase);

    expect(resultado).toBe(true);
  });
});
