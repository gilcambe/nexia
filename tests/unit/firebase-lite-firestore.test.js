'use strict';

// Mock das dependências
jest.mock('https');
jest.mock('http');
jest.mock('crypto');

const https = require('https');
const http = require('http');
const crypto = require('crypto');

const {
  Firestore,
  registrarUsoBanco,
  getUsoBanco,
  getBancosUsoGeral,
  getCachedFirestoreRead,
  setCachedFirestoreRead,
  invalidateFirestoreCache,
  getNextBank,
  switchToNextBank,
  checkBankHealth,
  BANK_LIMITS,
  ordemBancos,
  getBancoAtivo,
  usoDiarioBancos
} = require('../../lib/firebase-lite/firestore.js');

describe('firebase-lite/firestore', () => {
  beforeEach(() => {
    // Limpar estado global
    usoDiarioBancos.clear();
    firestoreReadCache.clear();
    bancoAtual = 'firestore-default';
    
    // Mock do crypto
    crypto.createHash = jest.fn().mockReturnValue({
      update: jest.fn().mockReturnThis(),
      digest: jest.fn().mockReturnValue('mocked_hash')
    });
    
    // Mock do fetch para Central
    global.fetch = jest.fn();
  });

  describe('registrarUsoBanco', () => {
    test('deve registrar uso do banco corretamente', () => {
      const hoje = new Date().toISOString().slice(0, 10);
      
      registrarUsoBanco('firestore-default', 10, 5);
      
      const uso = getUsoBanco('firestore-default');
      expect(uso.data).toBe(hoje);
      expect(uso.leituras).toBe(10);
      expect(uso.escritas).toBe(5);
      expect(uso.status).toBe('ativo');
    });

    test('deve acumular múltiplas chamadas', () => {
      registrarUsoBanco('firestore-default', 10, 5);
      registrarUsoBanco('firestore-default', 5, 3);
      
      const uso = getUsoBanco('firestore-default');
      expect(uso.leituras).toBe(15);
      expect(uso.escritas).toBe(8);
    });

    test('deve marcar status como quase cheio ao atingir 70%', () => {
      // Simular uso que atinge 70% do limite (35k/50k leituras)
      for (let i = 0; i < 35; i++) {
        registrarUsoBanco('firestore-default', 1000, 0);
      }
      
      const uso = getUsoBanco('firestore-default');
      expect(uso.status).toBe('quase cheio');
    });
  });

  describe('getUsoBanco', () => {
    test('deve retornar uso do banco', () => {
      registrarUsoBanco('firestore-default', 1000, 500);
      
      const uso = getUsoBanco('firestore-default');
      expect(uso.leituras).toBe(1000);
      expect(uso.escritas).toBe(500);
    });

    test('deve retornar valores padrão para banco não usado', () => {
      const uso = getUsoBanco('banco-inexistente');
      expect(uso.leituras).toBe(0);
      expect(uso.escritas).toBe(0);
      expect(uso.status).toBe('ativo');
    });
  });

  describe('getBancosUsoGeral', () => {
    test('deve retornar uso de todos os bancos', () => {
      registrarUsoBanco('firestore-default', 1000, 500);
      registrarUsoBanco('firestore-b', 2000, 1000);
      
      const bancos = getBancosUsoGeral();
      expect(bancos).toHaveLength(Object.keys(BANK_LIMITS).length);
      expect(bancos[0].banco).toBe('firestore-default');
      expect(bancos[0].reads).toBe(1000);
      expect(bancos[1].banco).toBe('firestore-b');
      expect(bancos[1].reads).toBe(2000);
    });
  });

  describe('cache em memória', () => {
    test('deve armazenar e recuperar cache', () => {
      const tenantId = 'tenant-123';
      const collection = 'clients';
      const docId = 'doc-456';
      const record = { id: 'doc-456', name: 'Test' };
      
      setCachedFirestoreRead(tenantId, collection, docId, record);
      
      const cached = getCachedFirestoreRead(tenantId, collection, docId);
      expect(cached).toEqual(record);
    });

    test('deve expirar cache após TTL', () => {
      const tenantId = 'tenant-123';
      const collection = 'clients';
      const docId = 'doc-456';
      const record = { id: 'doc-456', name: 'Test' };
      
      // Mock do tempo para expirar o cache
      const originalNow = Date.now;
      Date.now = jest.fn().mockReturnValue(1000000);
      
      setCachedFirestoreRead(tenantId, collection, docId, record);
      
      // Avançar tempo para expirar
      Date.now = jest.fn().mockReturnValue(1000000 + 61 * 1000);
      
      const cached = getCachedFirestoreRead(tenantId, collection, docId);
      expect(cached).toBeNull();
      
      // Restaurar tempo original
      Date.now = originalNow;
    });

    test('deve invalidar cache corretamente', () => {
      const tenantId = 'tenant-123';
      const collection = 'clients';
      const docId = 'doc-456';
      const record = { id: 'doc-456', name: 'Test' };
      
      setCachedFirestoreRead(tenantId, collection, docId, record);
      expect(getCachedFirestoreRead(tenantId, collection, docId)).not.toBeNull();
      
      invalidateFirestoreCache(tenantId, collection, docId);
      expect(getCachedFirestoreRead(tenantId, collection, docId)).toBeNull();
    });
  });

  describe('rodízio de bancos', () => {
    test('deve retornar próximo banco na ordem', () => {
      bancoAtual = 'firestore-default';
      const proximo = getNextBank();
      expect(proximo).toBe('firestore-b');
    });

    test('deve alternar para o próximo banco', () => {
      bancoAtual = 'firestore-default';
      const novo = switchToNextBank();
      expect(novo).toBe('firestore-b');
      expect(bancoAtual).toBe('firestore-b');
    });

    test('deve permanecer no último banco se não houver próximo', () => {
      bancoAtual = 'cofresql';
      const novo = switchToNextBank();
      expect(novo).toBe('cofresql');
      expect(bancoAtual).toBe('cofresql');
    });

    test('deve verificar saúde do banco', () => {
      // Banco saudável
      expect(checkBankHealth('firestore-default')).toBe(true);
      
      // Banco quase cheio (simulado)
      for (let i = 0; i < 35; i++) {
        registrarUsoBanco('firestore-default', 1000, 0);
      }
      expect(checkBankHealth('firestore-default')).toBe(false);
    });
  });

  describe('Firestore class', () => {
    test('deve usar banco saudável por padrão', () => {
      const firestore = new Firestore();
      expect(firestore._bancoAtual).toBe('firestore-default');
    });

    test('deve alternar para banco saudável se atual estiver quase cheio', () => {
      // Simular banco quase cheio
      for (let i = 0; i < 35; i++) {
        registrarUsoBanco('firestore-default', 1000, 0);
      }
      
      const firestore = new Firestore();
      expect(firestore._bancoAtual).toBe('firestore-b');
    });
  });
});
