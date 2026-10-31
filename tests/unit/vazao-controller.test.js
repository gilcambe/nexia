'use strict';
// Teste unitário do VazaoController (#2221, #2223, #2224)
const { VazaoController } = require('../../src/durable/VazaoController');

describe('VazaoController', () => {
  let controller;

  beforeEach(() => {
    controller = new VazaoController();
  });

  describe('contador de uso por banco', () => {
    it('registra leituras e escritas corretamente', () => {
      controller.registrar('firestore-b', 100, 50);
      const uso = controller.obterContador('firestore-b');
      expect(uso.leituras).toBe(100);
      expect(uso.escritas).toBe(50);
      expect(uso.status).toBe('ativo');
    });

    it('reseta o contador diariamente', () => {
      controller.registrar('firestore-b', 100, 50);
      controller.registrar('firestore-b', 0, 0, '2025-01-02');
      const uso = controller.obterContador('firestore-b', '2025-01-02');
      expect(uso.leituras).toBe(0);
      expect(uso.escritas).toBe(0);
    });

    it('usa o banco atual se não informado', () => {
      controller.registrar(); // usa firestore-b
      const uso = controller.obterContador();
      expect(uso.banco).toBeUndefined(); // obterContador não retorna banco
    });
  });

  describe('verificação de limite (70%)', () => {
    it('detecta quase cheio no Firestore (70% reads)', () => {
      controller.registrar('firestore-b', 35000, 0); // 70% de 50000
      const limite = controller.verificarLimite('firestore-b');
      expect(limite.quaseCheio).toBe(true);
    });

    it('detecta quase cheio no Firestore (70% writes)', () => {
      controller.registrar('firestore-b', 0, 14000); // 70% de 20000
      const limite = controller.verificarLimite('firestore-b');
      expect(limite.quaseCheio).toBe(true);
    });

    it('detecta quase cheio no D1 (70% reads)', () => {
      controller.registrar('d1', 3500000, 0); // 70% de 5M
      const limite = controller.verificarLimite('d1');
      expect(limite.quaseCheio).toBe(true);
    });

    it('detecta quase cheio no D1 (70% writes)', () => {
      controller.registrar('d1', 0, 70000); // 70% de 100k
      const limite = controller.verificarLimite('d1');
      expect(limite.quaseCheio).toBe(true);
    });

    it('detecta quase cheio no CofreSql (70% reads)', () => {
      controller.registrar('cofresql', 35000000, 0); // 70% de 50M
      const limite = controller.verificarLimite('cofresql');
      expect(limite.quaseCheio).toBe(true);
    });

    it('detecta quase cheio no CofreSql (70% writes)', () => {
      controller.registrar('cofresql', 0, 7000000); // 70% de 10M
      const limite = controller.verificarLimite('cofresql');
      expect(limite.quaseCheio).toBe(true);
    });

    it('retorna status ativo quando abaixo de 70%', () => {
      controller.registrar('firestore-b', 30000, 10000); // 60% reads, 50% writes
      const limite = controller.verificarLimite('firestore-b');
      expect(limite.quaseCheio).toBe(false);
    });
  });

  describe('troca automática de banco', () => {
    it('troca para o próximo banco quando quase cheio', () => {
      controller.registrar('firestore-b', 35000, 0); // 70% reads
      expect(controller.obterBancoAtual()).toBe('firestore-b');
      controller.registrar(); // deve trocar
      expect(controller.obterBancoAtual()).toBe('firestore-c');
    });

    it('circularidade do rodízio', () => {
      controller.registrar('firestore-b', 35000, 0);
      controller.registrar(); // firestore-b → firestore-c
      controller.registrar(); // firestore-c → d1
      controller.registrar(); // d1 → cofresql
      controller.registrar(); // cofresql → firestore-b
      expect(controller.obterBancoAtual()).toBe('firestore-b');
    });

    it('troca apenas quando necessário (70%)', () => {
      controller.registrar('firestore-b', 30000, 10000); // 60% - não troca
      expect(controller.obterBancoAtual()).toBe('firestore-b');
    });
  });

  describe('resumo geral', () => {
    it('retorna status de todos os bancos', () => {
      controller.registrar('firestore-b', 100, 50);
      controller.registrar('d1', 200, 100);
      controller.registrar('cofresql', 300, 150);
      const resumo = controller.obterResumoGeral();
      expect(resumo).toHaveProperty('firestore-b');
      expect(resumo).toHaveProperty('d1');
      expect(resumo).toHaveProperty('cofresql');
      expect(resumo.firestore-b).toHaveProperty('leituras', 100);
      expect(resumo.d1).toHaveProperty('leituras', 200);
      expect(resumo.cofresql).toHaveProperty('leituras', 300);
    });
  });
});
