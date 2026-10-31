'use strict';

const { VazaoController } = require('../../src/durable/VazaoController');
const { Firestore } = require('../../lib/firebase-lite/firestore');
const { createD1Backend } = require('../../lib/firebase-lite/d1-backend');

// Mock do driver do D1 para testes
const mockD1Driver = {
  exec: jest.fn(),
  toArray: jest.fn()
};

// Mock do fetch para testes de alertas
global.fetch = jest.fn();

describe('VazaoController - Sistema de Controle de Vazão', () => {
  let vazaoController;

  beforeEach(() => {
    vazaoController = new VazaoController({});
    mockD1Driver.exec.mockClear();
    mockD1Driver.toArray.mockClear();
    global.fetch.mockClear();
  });

  describe('1. Contador de uso por banco', () => {
    test('deve registrar leituras e escritas corretamente', () => {
      vazaoController.registrar('firestore-b', 100, 50);
      vazaoController.registrar('firestore-b', 200, 75);
      
      const uso = vazaoController.obterUsoDiario('firestore-b');
      expect(uso.leituras).toBe(300);
      expect(uso.escritas).toBe(125);
      expect(uso.status).toBe('ativo');
    });

    test('deve separar contagem por bancos diferentes', () => {
      vazaoController.registrar('firestore-b', 100, 50);
      vazaoController.registrar('firestore-c', 200, 75);
      
      const usoB = vazaoController.obterUsoDiario('firestore-b');
      const usoC = vazaoController.obterUsoDiario('firestore-c');
      
      expect(usoB.leituras).toBe(100);
      expect(usoB.escritas).toBe(50);
      expect(usoC.leituras).toBe(200);
      expect(usoC.escritas).toBe(75);
    });

    test('deve resetar contador no novo dia', () => {
      // Simular um novo dia
      const hoje = new Date();
      hoje.setDate(hoje.getDate() + 1);
      jest.spyOn(Date, 'now').mockReturnValue(hoje.getTime());
      
      vazaoController.registrar('firestore-b', 100, 50);
      
      const uso = vazaoController.obterUsoDiario('firestore-b');
      expect(uso.leituras).toBe(100);
      expect(uso.escritas).toBe(50);
      
      Date.now.mockRestore();
    });
  });

  describe('2. Troca antes de acabar (70% do limite)', () => {
    test('deve marcar banco como quase cheio ao atingir 70%', () => {
      // Firestore B: 50k leituras, 20k escritas
      // 70% = 35k leituras ou 14k escritas
      vazaoController.registrar('firestore-b', 35000, 0);
      
      const limite = vazaoController.verificarLimite('firestore-b');
      expect(limite.quaseCheio).toBe(true);
      expect(limite.status).toBe('quase cheio');
    });

    test('não deve marcar como quase cheio abaixo de 70%', () => {
      vazaoController.registrar('firestore-b', 34999, 0);
      
      const limite = vazaoController.verificarLimite('firestore-b');
      expect(limite.quaseCheio).toBe(false);
      expect(limite.status).toBe('ativo');
    });

    test('deve alternar para o próximo banco quando quase cheio', () => {
      const bancoInicial = vazaoController.getBancoAtivo();
      vazaoController.registrar('firestore-b', 35000, 0);
      
      const novoBanco = vazaoController.switchToNextBank();
      expect(novoBanco).not.toBe(bancoInicial);
      expect(vazaoController.getBancoAtivo()).toBe(novoBanco);
    });

    test('deve retornar alerta ao detectar banco quase cheio', () => {
      vazaoController.registrar('firestore-b', 35000, 0);
      
      const alerta = vazaoController.checarBancosQuaseCheios();
      expect(alerta).toBeTruthy();
      expect(alerta.bancoCheio).toBe('firestore-b');
      expect(alerta.alerta.tipo).toBe('sentinel');
      expect(alerta.alerta.passoAPasso).toHaveLength(3);
    });
  });

  describe('3. Cache em memória (TTL 60s)', () => {
    test('deve armazenar e recuperar cache de leituras', () => {
      const { getCachedFirestoreRead, setCachedFirestoreRead } = require('../../lib/firebase-lite/firestore');
      
      const tenantId = 'test-tenant';
      const collection = 'users';
      const docId = 'user123';
      const data = { name: 'John Doe', email: 'john@example.com' };
      
      // Armazenar no cache
      setCachedFirestoreRead(tenantId, collection, docId, data);
      
      // Recuperar do cache
      const cached = getCachedFirestoreRead(tenantId, collection, docId);
      expect(cached).toEqual(data);
    });

    test('deve expirar cache após TTL', () => {
      const { getCachedFirestoreRead, setCachedFirestoreRead } = require('../../lib/firebase-lite/firestore');
      
      const tenantId = 'test-tenant';
      const collection = 'users';
      const docId = 'user123';
      const data = { name: 'John Doe', email: 'john@example.com' };
      
      // Armazenar no cache
      setCachedFirestoreRead(tenantId, collection, docId, data);
      
      // Simular expiração (avançar tempo)
      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 61 * 1000);
      
      // Tentar recuperar cache expirado
      const cached = getCachedFirestoreRead(tenantId, collection, docId);
      expect(cached).toBeNull();
      
      Date.now.mockRestore();
    });

    test('deve invalidar cache em escritas', () => {
      const { getCachedFirestoreRead, setCachedFirestoreRead, invalidateFirestoreCache } = require('../../lib/firebase-lite/firestore');
      
      const tenantId = 'test-tenant';
      const collection = 'users';
      const docId = 'user123';
      const data = { name: 'John Doe', email: 'john@example.com' };
      
      // Armazenar no cache
      setCachedFirestoreRead(tenantId, collection, docId, data);
      
      // Invalidar cache
      invalidateFirestoreCache(tenantId, collection, docId);
      
      // Tentar recuperar cache invalidado
      const cached = getCachedFirestoreRead(tenantId, collection, docId);
      expect(cached).toBeNull();
    });
  });

  describe('4. Integração com D1 backend', () => {
    test('deve registrar uso do D1 corretamente', () => {
      const { registrarUsoD1, getUsoD1 } = require('../../lib/firebase-lite/d1-backend');
      
      // Registrar uso
      registrarUsoD1('d1-test', 1000, 500);
      registrarUsoD1('d1-test', 2000, 300);
      
      // Obter uso
      const uso = getUsoD1('d1-test');
      expect(uso.leituras).toBe(3000);
      expect(uso.escritas).toBe(800);
    });

    test('deve criar D1 backend com contador', () => {
      const backend = createD1Backend({
        driver: mockD1Driver,
        projectId: 'test-d1'
      });
      
      expect(backend.projectId).toBe('test-d1');
      expect(typeof backend.batchGet).toBe('function');
      expect(typeof backend.commit).toBe('function');
      expect(typeof backend.runQuery).toBe('function');
    });

    test('deve acionar alerta ao atingir 70% no D1', () => {
      const { registrarUsoD1 } = require('../../lib/firebase-lite/d1-backend');
      
      // D1: 5M leituras, 100k escritas
      // 70% = 3.5M leituras ou 70k escritas
      registrarUsoD1('d1-test', 3500000, 0);
      
      // Verificar se fetch foi chamado para enviar alerta
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
      );
    });
  });

  describe('5. Resumo geral de uso', () => {
    test('deve fornecer resumo de uso de todos os bancos', () => {
      vazaoController.registrar('firestore-b', 10000, 5000);
      vazaoController.registrar('firestore-c', 20000, 10000);
      vazaoController.registrar('d1', 100000, 50000);
      
      const resumo = vazaoController.obterUsoTodosBancos();
      
      expect(resumo).toHaveLength(4);
      expect(resumo[0].banco).toBe('firestore-b');
      expect(resumo[0].leituras).toBe(10000);
      expect(resumo[0].escritas).toBe(5000);
      expect(resumo[1].banco).toBe('firestore-c');
      expect(resumo[1].leituras).toBe(20000);
      expect(resumo[1].escritas).toBe(10000);
    });

    test('deve calcular percentuais corretamente', () => {
      // Firestore B: 50k leituras, 20k escritas
      // 10k leituras = 20%, 5k escritas = 25%
      vazaoController.registrar('firestore-b', 10000, 5000);
      
      const resumo = vazaoController.obterUsoTodosBancos();
      const firestoreB = resumo.find(b => b.banco === 'firestore-b');
      
      expect(firestoreB.percentualLeituras).toBe(20);
      expect(firestoreB.percentualEscritas).toBe(25);
    });
  });
});
