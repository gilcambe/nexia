'use strict';
// Testes unitários para o firestore.js - rodízio inteligente do Vault

const { Firestore, registrarUsoBanco, getUsoBanco, getBancosUsoGeral, getCachedFirestoreRead, setCachedFirestoreRead, invalidateFirestoreCache } = require('../../lib/firebase-lite/firestore');
const { VazaoController } = require('../../src/durable/VazaoController');

// Mock do módulo firestore para testes
jest.mock('../../lib/firebase-lite/firestore', () => {
  const originalModule = jest.requireActual('../../lib/firebase-lite/firestore');
  return {
    ...originalModule,
    firestoreRestRequest: jest.fn()
  };
});

describe('Firestore - Rodízio Inteligente', () => {
  let firestore;
  
  beforeEach(() => {
    firestore = new Firestore({ projectId: 'test-project' });
    jest.clearAllMocks();
  });

  test('deve inicializar com o primeiro banco da lista', () => {
    expect(firestore._bancoAtual).toBe('firestore-default');
  });

  test('deve registrar uso do banco corretamente', () => {
    registrarUsoBanco('firestore-b', 10, 5);
    const uso = getUsoBanco('firestore-b');
    expect(uso.leituras).toBe(10);
    expect(uso.escritas).toBe(5);
    expect(uso.status).toBe('ativo');
  });

  test('deve marcar banco como quase cheio ao atingir 70%', () => {
    const limite = 100;
    const setUsoDiarioBancos = new Map();
    
    // Simular uso que atinge 70%
    setUsoDiarioBancos.set('firestore-b', {
      data: new Date().toISOString().slice(0, 10),
      leituras: Math.floor(limite * 0.7),
      escritas: Math.floor(limite * 0.7),
      limiteLeituras: limite,
      limiteEscritas: limite,
      status: 'ativo'
    });
    
    // Simular a chamada de alerta
    const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock;
    
    // Chamar a função de registro
    registrarUsoBanco('firestore-b', Math.floor(limite * 0.7), Math.floor(limite * 0.7));
    
    const uso = getUsoBanco('firestore-b');
    expect(uso.status).toBe('quase cheio');
    expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('atingiu 70% da cota'));
    
    consoleWarn.mockRestore();
  });

  test('deve alternar para o próximo banco quando atual está quase cheio', () => {
    // Simular que o firestore-b está quase cheio
    const originalBancoAtual = 'firestore-b';
    
    // Criar uma instância forçando o banco atual
    firestore._bancoAtual = originalBancoAtual;
    
    // Simular que o banco está quase cheio
    const setUsoDiarioBancos = new Map();
    setUsoDiarioBancos.set(originalBancoAtual, {
      data: new Date().toISOString().slice(0, 10),
      leituras: 35000,
      escritas: 14000,
      limiteLeituras: 50000,
      limiteEscritas: 20000,
      status: 'quase cheio'
    });
    
    // Chamar a função de troca
    const novoBanco = require('../../lib/firebase-lite/firestore').switchToNextBank();
    
    expect(novoBanco).toBe('firestore-c');
    expect(firestore._bancoAtual).toBe('firestore-c');
  });

  test('deve retornar uso geral de todos os bancos', () => {
    // Registrar algum uso
    registrarUsoBanco('firestore-b', 1000, 500);
    registrarUsoBanco('firestore-c', 2000, 1000);
    
    const usoGeral = getBancosUsoGeral();
    
    expect(usoGeral).toHaveLength(5); // 5 bancos na configuração
    expect(usoGeral.find(b => b.banco === 'firestore-b')).toBeDefined();
    expect(usoGeral.find(b => b.banco === 'firestore-b').leituras).toBe(1000);
    expect(usoGeral.find(b => b.banco === 'firestore-c').leituras).toBe(2000);
  });
});

describe('Firestore - Cache em Memória', () => {
  test('deve armazenar e recuperar documento do cache', () => {
    const tenantId = 'test-tenant';
    const collection = 'test-collection';
    const docId = 'test-doc';
    const record = { id: docId, name: 'Test Document' };
    
    // Armazenar no cache
    setCachedFirestoreRead(tenantId, collection, docId, record);
    
    // Recuperar do cache
    const cached = getCachedFirestoreRead(tenantId, collection, docId);
    
    expect(cached).toEqual(record);
  });

  test('deve invalidar cache quando documento for atualizado', () => {
    const tenantId = 'test-tenant';
    const collection = 'test-collection';
    const docId = 'test-doc';
    const record = { id: docId, name: 'Test Document' };
    
    // Armazenar no cache
    setCachedFirestoreRead(tenantId, collection, docId, record);
    
    // Invalidar cache
    invalidateFirestoreCache(tenantId, collection, docId);
    
    // Tentar recuperar - deve ser nulo
    const cached = getCachedFirestoreRead(tenantId, collection, docId);
    expect(cached).toBeNull();
  });

  test('deve limpar cache quando TTL expirar', () => {
    const tenantId = 'test-tenant';
    const collection = 'test-collection';
    const docId = 'test-doc';
    const record = { id: docId, name: 'Test Document' };
    
    // Armazenar no cache
    setCachedFirestoreRead(tenantId, collection, docId, record);
    
    // Simular TTL expirado
    const cacheMap = require('../../lib/firebase-lite/firestore').firestoreReadCache;
    const cacheKey = `${tenantId}:${collection}:${docId}`;
    const cacheEntry = cacheMap.get(cacheKey);
    if (cacheEntry) {
      cacheEntry.expiresAt = Date.now() - 1000; // 1 segundo atrás
    }
    
    // Tentar recuperar - deve ser nulo
    const cached = getCachedFirestoreRead(tenantId, collection, docId);
    expect(cached).toBeNull();
  });
});

// Mock do módulo VazaoController para testes
jest.mock('../../src/durable/VazaoController', () => {
  return {
    VazaoController: jest.fn().mockImplementation(() => ({
      registrar: jest.fn(),
      verificarLimite: jest.fn(),
      obterContador: jest.fn(),
      proximoBanco: jest.fn(),
      obterBancoAtual: jest.fn(),
      obterResumoGeral: jest.fn(),
      obterUsoDiario: jest.fn(),
      obterUsoTodosBancos: jest.fn(),
      checarBancosQuaseCheios: jest.fn()
    }))
  };
});

describe('Integração Firestore e VazaoController', () => {
  let vazaoController;
  
  beforeEach(() => {
    vazaoController = new VazaoController();
    jest.clearAllMocks();
  });

  test('deve integrar contador de uso com VazaoController', () => {
    const mockRegistrar = jest.fn();
    vazaoController.registrar = mockRegistrar;
    
    // Simular chamada ao Firestore
    registrarUsoBanco('firestore-b', 10, 5);
    
    expect(mockRegistrar).toHaveBeenCalledWith('firestore-b', 10, 5);
  });

  test('deve verificar limite antes de cada operação', () => {
    const mockVerificarLimite = jest.fn().mockReturnValue({
      quaseCheio: false,
      leituras: 100,
      escritas: 50
    });
    vazaoController.verificarLimite = mockVerificarLimite;
    
    // Simular chamada ao Firestore
    registrarUsoBanco('firestore-b', 10, 5);
    
    expect(mockVerificarLimite).toHaveBeenCalledWith('firestore-b');
  });
});