const nota = require('../nota');

describe('nota function', () => {
  test('returns acertou: true when all keywords are present in the client\'s speech', () => {
    const falaCliente = 'Eu gostaria de saber sobre o plano premium';
    const respostaAtendente = 'O plano premium custa R$ 99,90 por mês';
    const palavrasChave = ['plano', 'premium'];

    const result = nota(falaCliente, respostaAtendente, palavrasChave);

    expect(result.acertou).toBe(true);
    expect(result.fraseModelo).toBe(respostaAtendente);
    expect(result.traducaoPt).toBe(respostaAtendente);
  });

  test('returns acertou: false when not all keywords are present in the client\'s speech', () => {
    const falaCliente = 'Eu gostaria de saber sobre o plano básico';
    const respostaAtendente = 'O plano premium custa R$ 99,90 por mês';
    const palavrasChave = ['plano', 'premium'];

    const result = nota(falaCliente, respostaAtendente, palavrasChave);

    expect(result.acertou).toBe(false);
    expect(result.fraseModelo).toBe(respostaAtendente);
    expect(result.traducaoPt).toBe(respostaAtendente);
  });

  test('returns acertou: true when keywords are present in different cases', () => {
    const falaCliente = 'Eu GOSTARIA de SABER sobre o PLANO Premium';
    const respostaAtendente = 'O plano premium custa R$ 99,90 por mês';
    const palavrasChave = ['plano', 'premium'];

    const result = nota(falaCliente, respostaAtendente, palavrasChave);

    expect(result.acertou).toBe(true);
    expect(result.fraseModelo).toBe(respostaAtendente);
    expect(result.traducaoPt).toBe(respostaAtendente);
  });

  test('returns acertou: false when no keywords are present', () => {
    const falaCliente = 'Eu gostaria de saber sobre o suporte técnico';
    const respostaAtendente = 'O plano premium custa R$ 99,90 por mês';
    const palavrasChave = ['plano', 'premium'];

    const result = nota(falaCliente, respostaAtendente, palavrasChave);

    expect(result.acertou).toBe(false);
    expect(result.fraseModelo).toBe(respostaAtendente);
    expect(result.traducaoPt).toBe(respostaAtendente);
  });

  test('returns acertou: true when keywords are present in the middle of the sentence', () => {
    const falaCliente = 'Eu gostaria de saber sobre o plano premium e seus benefícios';
    const respostaAtendente = 'O plano premium custa R$ 99,90 por mês';
    const palavrasChave = ['plano', 'premium'];

    const result = nota(falaCliente, respostaAtendente, palavrasChave);

    expect(result.acertou).toBe(true);
    expect(result.fraseModelo).toBe(respostaAtendente);
    expect(result.traducaoPt).toBe(respostaAtendente);
  });
});
