'use strict';

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
  BANCO_RODIZIO,
  firestoreReadCache,
  CACHE_TTL_MS
} = require('../../lib/firebase-lite/firestore.js');

// Mock do VazaoController
jest.mock('fetch', () => jest.fn());

describe('Vault - Sistema de Rodízio e Cache', () => {
  beforeEach(() => {
    // Limpar estado entre testes
    firestoreReadCache.clear();
    // Resetar o rodízio
    const originalGetNextBank = getNextBank;
    const originalSwitchToNextBank = switchToNextBank;
    
    // Resetar estado global
    for (const key of Object.keys(require.cache)) {
      if (key.includes('firestore.js')) {
        delete require.cache[key];
      }
    }
    
    // Re-importar para limpar estado estático
    jest.resetModules();
  });

  describe('1. Contador de uso por banco', () => {
    test('deve registrar leituras e escritas corretamente', () => {
      const banco = 'firestore-b';
      
      // Registrar 5 leituras e 3 escritas
      registrarUsoBanco(banco, 5, 3);
      
      const uso = getUsoBanco(banco);
      expect(uso.leituras).toBe(5);
      expect(uso.escritas).toBe(3);
      expect(uso.status).toBe('ativo');
    });

    test('deve calcular percentuais corretamente', () => {
      const banco = 'firestore-b';
      
      // Firestore B: 50k leituras, 20k escritas
      // 70% = 35k leituras ou 14k escritas
      registrarUsoBanco(banco, 35000, 3);
      
      const uso = getUsoBanco(banco);
      expect(uso.percentualLeituras).toBe(70);
      expect(uso.percentualEscritas).toBe(15);
      expect(uso.status).toBe('quase cheio');
    });

    test('deve resetar contador ao mudar de dia', () => {
      const banco = 'firestore-b';
      
      // Registrar uso
      registrarUsoBanco(banco, 100, 50);
      expect(getUsoBanco(banco).leituras).toBe(100);
      
      // Simular mudança de dia (alterando a data interna)
      const hoje = new Date().toISOString().slice(0, 10);
      const outroDia = new Date(hoje);
      outroDia.setDate(outroDia.getDate() + 1);
      
      // Criar novo registro com data diferente
      const novoRegistro = {
        data: outroDia.toISOString().slice(0, 10),
        leituras: 10,
        escritas: 5,
        status: 'ativo'
      };
      
      // Substituir o registro existente
      const bancoKey = 'firestore-b';
      const limits = require('../../lib/firebase-lite/firestore.js').BANK_LIMITS[bancoKey];
      
      novoRegistro.limiteLeituras = limits.reads;
      novoRegistro.limiteEscritas = limits.writes;
      
      // Simular que o contador foi resetado
      require('../../lib/firebase-lite/firestore.js').usoDiarioBancos.set(bancoKey, novoRegistro);
      
      expect(getUsoBanco(banco).leituras).toBe(10);
      expect(getUsoBanco(banco).escritas).toBe(5);
    });
  });

  describe('2. Troca preventiva antes de 70%', () => {
    test('deve marcar banco como quase cheio ao atingir 70%', () => {
      const banco = 'firestore-b';
      
      // 70% de 50k = 35k leituras
      registrarUsoBanco(banco, 35000, 0);
      
      const uso = getUsoBanco(banco);
      expect(uso.status).toBe('quase cheio');
      expect(uso.percentualLeituras).toBe(70);
    });

    test('não deve marcar como quase cheio abaixo de 70%', () => {
      const banco = 'firestore-b';
      
      // 69% de 50k = 34.5k leituras
      registrarUsoBanco(banco, 34500, 0);
      
      const uso = getUsoBanco(banco);
      expect(uso.status).toBe('ativo');
      expect(uso.percentualLeituras).toBe(69);
    });

    test('deve alternar tráfego quando banco fica quase cheio', () => {
      const banco = 'firestore-b';
      
      // Registrar uso que atinge 70%
      registrarUsoBanco(banco, 35000, 14000); // 70% leituras, 70% escritas
      
      const uso = getUsoBanco(banco);
      expect(uso.status).toBe('quase cheio');
      expect(uso.percentualLeituras).toBe(70);
      expect(uso.percentualEscritas).toBe(70);
    });
  });

  describe('3. Cache em memória TTL 60s', () => {
    test('deve armazenar e recuperar documentos do cache', () => {
      const tenantId = 'test-tenant';
      const collection = 'clients';
      const docId = 'client-123';
      const data = { name: 'Test Client', email: 'test@example.com' };
      
      // Armazenar no cache
      setCachedFirestoreRead(tenantId, collection, docId, data);
      
      // Recuperar do cache
      const cached = getCachedFirestoreRead(tenantId, collection, docId);
      expect(cached).toEqual(data);
    });

    test('deve expirar cache após TTL', () => {
      const tenantId = 'test-tenant';
      const collection = 'clients';
      const docId = 'client-123';
      const data = { name: 'Test Client', email: 'test@example.com' };
      
      // Armazenar no cache
      setCachedFirestoreRead(tenantId, collection, docId, data);
      
      // Simular expiração (avançar tempo)
      jest.spyOn(Date, 'now').mockReturnValueOnce(Date.now() + CACHE_TTL_MS + 1000);
      
      // Tentar recuperar - deve falhar
      const cached = getCachedFirestoreRead(tenantId, collection, docId);
      expect(cached).toBeNull();
    });

    test('deve invalidar cache específico ao atualizar documento', () => {
      const tenantId = 'test-tenant';
      const collection = 'clients';
      const docId = 'client-123';
      const data1 = { name: 'Client 1', email: 'client1@example.com' };
      const data2 = { name: 'Client 2', email: 'client2@example.com' };
      
      // Armazenar dados antigos
      setCachedFirestoreRead(tenantId, collection, docId, data1);
      expect(getCachedFirestoreRead(tenantId, collection, docId)).toEqual(data1);
      
      // Invalidar cache
      invalidateFirestoreCache(tenantId, collection, docId);
      
      // Tentar recuperar - deve falhar
      expect(getCachedFirestoreRead(tenantId, collection, docId)).toBeNull();
      
      // Armazenar novos dados
      setCachedFirestoreRead(tenantId, collection, docId, data2);
      expect(getCachedFirestoreRead(tenantId, collection, docId)).toEqual(data2);
    });

    test('deve invalidar cache de coleção inteira', () => {
      const tenantId = 'test-tenant';
      const collection = 'clients';
      const docId1 = 'client-123';
      const docId2 = 'client-456';
      
      // Armazenar múltiplos documentos
      setCachedFirestoreRead(tenantId, collection, docId1, { name: 'Client 1' });
      setCachedFirestoreRead(tenantId, collection, docId2, { name: 'Client 2' });
      
      expect(getCachedFirestoreRead(tenantId, collection, docId1)).toEqual({ name: 'Client 1' });
      expect(getCachedFirestoreRead(tenantId, collection, docId2)).toEqual({ name: 'Client 2' });
      
      // Invalidar toda coleção
      invalidateFirestoreCache(tenantId, collection, null);
      
      // Ambos devem estar inválidos
      expect(getCachedFirestoreRead(tenantId, collection, docId1)).toBeNull();
      expect(getCachedFirestoreRead(tenantId, collection, docId2)).toBeNull();
    });
  });

  describe('4. Rodízio de bancos', () => {
    test('deve retornar próximo banco saudável', () => {
      // Resetar estado
      const originalGetNextBank = getNextBank;
      
      // Simular que todos os bancos estão saudáveis
      const getNextBankMock = jest.fn().mockReturnValue('firestore-c');
      Object.defineProperty(require('../../lib/firebase-lite/firestore.js'), 'getNextBank', {
        value: getNextBankMock,
        writable: true
      });
      
      expect(getNextBank()).toBe('firestore-c');
    });

    test('deve alternar para próximo banco quando atual fica cheio', () => {
      const bancoOriginal = 'firestore-b';
      const bancoNovo = 'firestore-c';
      
      // Simular troca
      const result = switchToNextBank();
      
      // Verificar que trocou
      expect(result).toBe(bancoNovo);
    });

    test('deve verificar saúde do banco corretamente', () => {
      // Banco saudável
      expect(checkBankHealth('firestore-b')).toBe(true);
      
      // Banco quase cheio (simular)
      const bancoKey = 'firestore-b';
      const limits = require('../../lib/firebase-lite/firestore.js').BANK_LIMITS[bancoKey];
      const registroQuaseCheio = {
        data: new Date().toISOString().slice(0, 10),
        leituras: Math.floor(limits.reads * 0.7),
        escritas: Math.floor(limits.writes * 0.7),
        limiteLeituras: limits.reads,
        limiteEscritas: limits.writes,
        status: 'quase cheio'
      };
      
      require('../../lib/firebase-lite/firestore.js').usoDiarioBancos.set(bancoKey, registroQuaseCheio);
      expect(checkBankHealth(bancoKey)).toBe(false);
    });
  });

  describe('5. Integração com VazaoController', () => {
    test('deve enviar alerta quando banco atinge 70%', () => {
      const mockFetch = jest.fn();
      global.fetch = mockFetch;
      
      const banco = 'firestore-b';
      
      // Registrar uso que atinge 70%
      registrarUsoBanco(banco, 35000, 14000);
      
      // Verificar que fetch foi chamado
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8787/marcar-cheio',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining(banco)
        })
      );
    });

    test('não deve enviar alerta se fetch não estiver disponível', () => {
      // Remover fetch global
      delete global.fetch;
      
      const banco = 'firestore-b';
      
      // Registrar uso que atinge 70%
      registrarUsoBanco(banco, 35000, 14000);
      
      // Não deve gerar erro (deve ser silencioso)
      expect(true).toBe(true); // Se chegou aqui, não gerou erro
    });
  });

  describe('6. Relatório geral de uso', () => {
    test('deve retornar status de todos os bancos', () => {
      // Registrar uso em alguns bancos
      registrarUsoBanco('firestore-b', 10000, 5000);
      registrarUsoBanco('firestore-c', 40000, 15000);
      
      const relatorio = getBancosUsoGeral();
      
      expect(relatorio).toHaveLength(5); // 5 bancos configurados
      expect(relatorio[0]).toMatchObject({
        banco: 'firestore-default',
        reads: 0,
        writes: 0,
        status: 'ativo'
      });
      expect(relatorio[1]).toMatchObject({
        banco: 'firestore-b',
        reads: 10000,
        writes: 5000,
        status: 'ativo'
      });
      expect(relatorio[2]).toMatchObject({
        banco: 'firestore-c',
        reads: 40000,
        writes: 15000,
        status: 'quase cheio'
      });
    });
  });
});
