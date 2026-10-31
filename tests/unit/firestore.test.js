'use strict';

const {
  Firestore,
  registrarUsoBanco,
  getUsoBanco,
  getBancosUsoGeral,
  getCachedFirestoreRead,
  setCachedFirestoreRead,
  invalidateFirestoreCache,
  switchToNextBank,
  getBancoAtivo,
  ordemBancos,
  BANK_LIMITS,
  usoDiarioBancos
} = require('../../lib/firebase-lite/firestore.js');

// Mock do fetch para testar o envio de alertas
global.fetch = jest.fn();

describe('Vault Firestore - Rodízio e Controle de Uso', () => {
  beforeEach(() => {
    // Limpar o estado antes de cada teste
    usoDiarioBancos.clear();
    // Resetar o banco atual para o primeiro da lista
    global.bancoAtual = 'firestore-default';
    
    // Limpar o cache
    const cache = require('../../lib/firebase-lite/firestore.js').firestoreReadCache;
    cache.clear();
    
    // Limpar o mock do fetch
    fetch.mockClear();
  });

  describe('1. Contador de uso por banco', () => {
    test('deve registrar leituras e escritas corretamente', () => {
      const banco = 'firestore-default';
      
      // Registrar algumas operações
      registrarUsoBanco(banco, 10, 5);
      registrarUsoBanco(banco, 20, 15);
      
      const uso = getUsoBanco(banco);
      
      expect(uso.leituras).toBe(30);
      expect(uso.escritas).toBe(20);
      expect(uso.status).toBe('ativo');
    });

    test('deve criar novo registro quando o dia muda', () => {
      const banco = 'firestore-default';
      
      // Simular um novo dia (alterando a data no formato ISO)
      const originalDate = Date.now();
      global.Date.now = () => originalDate + (24 * 60 * 60 * 1000); // 1 dia depois
      
      registrarUsoBanco(banco, 10, 5);
      
      const uso = getUsoBanco(banco);
      
      expect(uso.leituras).toBe(10);
      expect(uso.escritas).toBe(5);
      expect(uso.status).toBe('ativo');
      
      // Restaurar a data original
      global.Date.now = () => originalDate;
    });

    test('deve retornar todos os bancos com seus usos', () => {
      // Registrar operações em diferentes bancos
      registrarUsoBanco('firestore-default', 1000, 500);
      registrarUsoBanco('firestore-b', 2000, 1000);
      registrarUsoBanco('d1', 100000, 50000);
      
      const bancosUso = getBancosUsoGeral();
      
      expect(bancosUso).toHaveLength(5); // 5 bancos definidos
      expect(bancosUso[0]).toEqual({
        banco: 'firestore-default',
        status: 'ativo',
        reads: 1000,
        writes: 500,
        limiteReads: BANK_LIMITS['firestore-default'].reads,
        limiteWrites: BANK_LIMITS['firestore-default'].writes
      });
    });
  });

  describe('2. Troca antes de acabar (70% do limite)', () => {
    test('deve marcar banco como quase cheio ao atingir 70%', () => {
      const banco = 'firestore-default';
      const limite = BANK_LIMITS[banco].reads;
      const uso70 = Math.floor(limite * 0.7);
      
      // Registrar uso para atingir 70%
      registrarUsoBanco(banco, uso70, 0);
      
      const uso = getUsoBanco(banco);
      expect(uso.status).toBe('quase cheio');
    });

    test('deve enviar alerta para Central ao atingir 70%', () => {
      const banco = 'firestore-default';
      const limite = BANK_LIMITS[banco].reads;
      const uso70 = Math.floor(limite * 0.7);
      
      // Mock do fetch para simular sucesso
      fetch.mockResolvedValue({
        ok: true,
        status: 200
      });
      
      // Registrar uso para atingir 70%
      registrarUsoBanco(banco, uso70, 0);
      
      // Verificar se o fetch foi chamado
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/central/alerta-sentinel'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
      );
    });

    test('deve alternar para o próximo banco quando o atual está quase cheio', () => {
      // Começar com firestore-default
      expect(getBancoAtivo()).toBe('firestore-default');
      
      // Simular que firestore-default está quase cheio
      const limite = BANK_LIMITS['firestore-default'].reads;
      const uso70 = Math.floor(limite * 0.7);
      registrarUsoBanco('firestore-default', uso70, 0);
      
      // Criar nova instância de Firestore - deve alternar para o próximo banco
      const firestore = new Firestore();
      
      expect(firestore._bancoAtual).toBe('firestore-b');
    });

    test('deve seguir a ordem correta do rodízio (B -> C -> D1 -> CofreSql)', () => {
      // Testar a sequência completa
      let banco = getBancoAtivo();
      
      // Simular que cada banco está cheio e verificar a transição
      for (let i = 0; i < ordemBancos.length - 1; i++) {
        banco = switchToNextBank();
        expect(banco).toBe(ordemBancos[i + 1]);
      }
      
      // Último banco deve permanecer o mesmo
      const ultimoBanco = switchToNextBank();
      expect(ultimoBanco).toBe(ordemBancos[ordemBancos.length - 1]);
    });
  });

  describe('3. Cache em memória (TTL 60s)', () => {
    test('deve guardar e recuperar documento do cache', () => {
      const tenantId = 'test-tenant';
      const collection = 'users';
      const docId = 'user123';
      const data = { name: 'John Doe', email: 'john@example.com' };
      
      // Guardar no cache
      setCachedFirestoreRead(tenantId, collection, docId, data);
      
      // Recuperar do cache
      const cachedData = getCachedFirestoreRead(tenantId, collection, docId);
      
      expect(cachedData).toEqual(data);
    });

    test('deve expirar cache após TTL', () => {
      const tenantId = 'test-tenant';
      const collection = 'users';
      const docId = 'user123';
      const data = { name: 'John Doe', email: 'john@example.com' };
      
      // Guardar no cache
      setCachedFirestoreRead(tenantId, collection, docId, data);
      
      // Simular que o tempo expirou
      const cache = require('../../lib/firebase-lite/firestore.js').firestoreReadCache;
      for (const [key, value] of cache) {
        value.expiresAt = Date.now() - 1000; // 1 segundo atrás
      }
      
      // Tentar recuperar - deve retornar null
      const cachedData = getCachedFirestoreRead(tenantId, collection, docId);
      expect(cachedData).toBeNull();
    });

    test('deve invalidar cache ao escrever documento', () => {
      const tenantId = 'test-tenant';
      const collection = 'users';
      const docId = 'user123';
      const data = { name: 'John Doe', email: 'john@example.com' };
      
      // Guardar no cache
      setCachedFirestoreRead(tenantId, collection, docId, data);
      
      // Verificar que está no cache
      expect(getCachedFirestoreRead(tenantId, collection, docId)).toEqual(data);
      
      // Invalidar cache
      invalidateFirestoreCache(tenantId, collection, docId);
      
      // Verificar que foi removido do cache
      expect(getCachedFirestoreRead(tenantId, collection, docId)).toBeNull();
    });

    test('deve invalidar cache de coleção específico', () => {
      const tenantId = 'test-tenant';
      
      // Guardar múltiplos documentos
      setCachedFirestoreRead(tenantId, 'users', 'user1', { name: 'User 1' });
      setCachedFirestoreRead(tenantId, 'users', 'user2', { name: 'User 2' });
      setCachedFirestoreRead(tenantId, 'products', 'prod1', { name: 'Product 1' });
      
      // Invalidar apenas a coleção 'users'
      invalidateFirestoreCache(tenantId, 'users', null);
      
      // Verificar que documentos da coleção 'users' foram removidos
      expect(getCachedFirestoreRead(tenantId, 'users', 'user1')).toBeNull();
      expect(getCachedFirestoreRead(tenantId, 'users', 'user2')).toBeNull();
      
      // Verificar que documentos de outras coleções permanecem
      expect(getCachedFirestoreRead(tenantId, 'products', 'prod1')).toEqual({ name: 'Product 1' });
    });

    test('deve invalidar todo o cache quando parâmetros são nulos', () => {
      // Guardar múltiplos documentos
      setCachedFirestoreRead('tenant1', 'users', 'user1', { name: 'User 1' });
      setCachedFirestoreRead('tenant1', 'products', 'prod1', { name: 'Product 1' });
      setCachedFirestoreRead('tenant2', 'users', 'user2', { name: 'User 2' });
      
      // Invalidar tudo
      invalidateFirestoreCache(null, null, null);
      
      // Verificar que tudo foi removido
      expect(getCachedFirestoreRead('tenant1', 'users', 'user1')).toBeNull();
      expect(getCachedFirestoreRead('tenant1', 'products', 'prod1')).toBeNull();
      expect(getCachedFirestoreRead('tenant2', 'users', 'user2')).toBeNull();
    });
  });

  describe('4. Integração com Firestore class', () => {
    test('deve usar o banco ativo ao criar instância', () => {
      const firestore = new Firestore();
      expect(firestore._bancoAtual).toBe(getBancoAtivo());
    });

    test('deve trocar banco automaticamente se o atual estiver cheio', () => {
      // Simular que o banco atual está cheio
      const limite = BANK_LIMITS[getBancoAtivo()].reads;
      const uso70 = Math.floor(limite * 0.7);
      registrarUsoBanco(getBancoAtivo(), uso70, 0);
      
      // Criar nova instância - deve alternar
      const firestore = new Firestore();
      expect(firestore._bancoAtual).toBe('firestore-b');
    });
  });
});
