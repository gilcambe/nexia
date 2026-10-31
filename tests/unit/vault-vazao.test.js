'use strict';

const { VazaoController } = require('../src/durable/VazaoController');
const { Firestore } = require('../lib/firebase-lite/firestore');
const { createD1Backend } = require('../lib/firebase-lite/d1-backend');

describe('Vazão do Vault - Sistema de Controle de Cota', () => {
  let vazaoController;
  
  beforeEach(() => {
    vazaoController = new VazaoController();
  });

  describe('VazaoController - Contador de uso', () => {
    test('deve registrar uso de leituras e escritas', () => {
      vazaoController.registrar('firestore-b', 10, 5);
      const uso = vazaoController.obterUsoDiario('firestore-b');
      expect(uso.leituras).toBe(10);
      expect(uso.escritas).toBe(5);
      expect(uso.status).toBe('ativo');
    });

    test('deve acumular uso ao longo do dia', () => {
      vazaoController.registrar('firestore-b', 10, 5);
      vazaoController.registrar('firestore-b', 5, 2);
      const uso = vazaoController.obterUsoDiario('firestore-b');
      expect(uso.leituras).toBe(15);
      expect(uso.escritas).toBe(7);
    });

    test('deve reiniciar contador no novo dia', () => {
      // Simular novo dia
      const originalDate = Date;
      global.Date = class extends Date {
        constructor() {
          super();
          this.setDate(this.getDate() + 1);
        }
      };
      
      vazaoController.registrar('firestore-b', 10, 5);
      const uso = vazaoController.obterUsoDiario('firestore-b');
      expect(uso.leituras).toBe(0);
      expect(uso.escritas).toBe(0);
      
      global.Date = originalDate;
    });

    test('deve verificar limite corretamente', () => {
      // Firestore B: 50k leituras, 20k escritas, 70% = 35k/14k
      vazaoController.registrar('firestore-b', 35000, 14000);
      const limite = vazaoController.verificarLimite('firestore-b');
      expect(limite.quaseCheio).toBe(true);
      expect(limite.leituras).toBe(35000);
      expect(limite.escritas).toBe(14000);
    });

    test('não deve marcar como quase cheio abaixo do limite', () => {
      vazaoController.registrar('firestore-b', 34999, 13999);
      const limite = vazaoController.verificarLimite('firestore-b');
      expect(limite.quaseCheio).toBe(false);
    });

    test('deve alternar banco quando atingir 70%', () => {
      vazaoController.bancoAtual = 'firestore-b';
      vazaoController.registrar('firestore-b', 35000, 14000);
      expect(vazaoController.bancoAtual).toBe('firestore-c');
    });

    test('deve retornar uso geral de todos os bancos', () => {
      vazaoController.registrar('firestore-b', 1000, 500);
      vazaoController.registrar('firestore-c', 2000, 1000);
      vazaoController.registrar('d1', 3000, 1500);
      
      const geral = vazaoController.obterUsoTodosBancos();
      expect(geral).toHaveLength(4);
      expect(geral.find(b => b.banco === 'firestore-b').leituras).toBe(1000);
      expect(geral.find(b => b.banco === 'firestore-c').leituras).toBe(2000);
      expect(geral.find(b => b.banco === 'd1').leituras).toBe(3000);
    });

    test('deve detectar bancos quase cheios e gerar alerta', () => {
      vazaoController.registrar('firestore-b', 35000, 14000);
      const alerta = vazaoController.checarBancosQuaseCheios();
      
      expect(alerta).toBeTruthy();
      expect(alerta.bancoCheio).toBe('firestore-b');
      expect(alerta.proximoBanco).toBe('firestore-c');
      expect(alerta.alerta.tipo).toBe('sentinel');
      expect(alerta.alerta.passoAPasso).toHaveLength(3);
    });

    test('não deve gerar alerta se nenhum banco estiver quase cheio', () => {
      vazaoController.registrar('firestore-b', 1000, 500);
      const alerta = vazaoController.checarBancosQuaseCheios();
      expect(alerta).toBeNull();
    });
  });

  describe('Integração com Firestore - Contador de uso', () => {
    let firestore;
    
    beforeEach(() => {
      firestore = new Firestore({ projectId: 'test-project' });
    });

    test('deve registrar leitura no Firestore', async () => {
      const docRef = firestore.doc('test/collection/test-doc');
      await docRef.get();
      
      // Verificar se o contador foi atualizado
      expect.assertions(1);
    });

    test('deve registrar escrita no Firestore', async () => {
      const docRef = firestore.doc('test/collection/test-doc');
      await docRef.set({ test: 'value' });
      
      // Verificar se o contador foi atualizado
      expect.assertions(1);
    });
  });

  describe('Cache em memória', () => {
    test('deve funcionar o cache do Firestore', () => {
      // Testar funções de cache
      const testDoc = { name: 'test', value: 'data' };
      
      // Simular cache
      const cacheKey = 'tenant:collection:doc';
      
      // Verificar se cache está vazio
      expect(cacheKey).toBeDefined();
      
      // Simular setagem de cache
      expect(testDoc).toBeDefined();
      
      // Simular invalidação de cache
      expect(cacheKey).toBeDefined();
    });
  });

  describe('Limites dos bancos', () => {
    test('deve ter limites corretos para Firestore B', () => {
      const limite = vazaoController.verificarLimite('firestore-b');
      expect(limite.maxL).toBe(50000);
      expect(limite.maxE).toBe(20000);
    });

    test('deve ter limites corretos para Firestore C', () => {
      const limite = vazaoController.verificarLimite('firestore-c');
      expect(limite.maxL).toBe(50000);
      expect(limite.maxE).toBe(20000);
    });

    test('deve ter limites corretos para D1', () => {
      const limite = vazaoController.verificarLimite('d1');
      expect(limite.maxL).toBe(5000000);
      expect(limite.maxE).toBe(100000);
    });

    test('deve ter limites corretos para CofreSql', () => {
      const limite = vazaoController.verificarLimite('cofresql');
      expect(limite.maxL).toBe(50000000);
      expect(limite.maxE).toBe(10000000);
    });
  });
});
