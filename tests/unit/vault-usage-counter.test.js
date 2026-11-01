'use strict';

// Testes para o contador de uso por banco do Vault
const {
  registrarUsoBanco,
  getUsoBanco,
  getBancosUsoGeral,
  BANK_LIMITS
} = require('../../lib/firebase-lite/firestore.js');

// Mock do fetch para testar comunicação com VazaoController
const originalFetch = global.fetch;
let mockFetchCalls = [];

beforeEach(() => {
  // Resetar estado
  usoDiarioBancos.clear();
  currentBancoIndex = 0;
  
  // Mock do fetch
  mockFetchCalls = [];
  global.fetch = jest.fn((url, options) => {
    mockFetchCalls.push({ url, options });
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: true })
    });
  });
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('registrarUsoBanco', () => {
  test('deve registrar uso de leituras para um banco', () => {
    const banco = 'firestore-b';
    const leituras = 100;
    const escritas = 0;
    
    registrarUsoBanco(banco, leituras, escritas);
    
    const uso = getUsoBanco(banco);
    expect(uso.leituras).toBe(leituras);
    expect(uso.escritas).toBe(escritas);
    expect(uso.status).toBe('ativo');
  });
  
  test('deve acumular múltiplas operações', () => {
    const banco = 'firestore-c';
    
    registrarUsoBanco(banco, 50, 10);
    registrarUsoBanco(banco, 30, 5);
    
    const uso = getUsoBanco(banco);
    expect(uso.leituras).toBe(80);
    expect(uso.escritas).toBe(15);
  });
  
  test('deve marcar banco como quase cheio quando atingir 70%', () => {
    const banco = 'firestore-b';
    const limiteLeituras = BANK_LIMITS[banco].reads;
    const limiteEscritas = BANK_LIMITS[banco].writes;
    
    // Registrar uso para atingir 70% das leituras
    registrarUsoBanco(banco, Math.floor(limiteLeituras * 0.7), 0);
    
    const uso = getUsoBanco(banco);
    expect(uso.status).toBe('quase cheio');
  });
  
  test('deve enviar alerta para VazaoController quando atingir 70%', () => {
    const banco = 'firestore-c';
    const limiteLeituras = BANK_LIMITS[banco].reads;
    
    registrarUsoBanco(banco, Math.floor(limiteLeituras * 0.7), 0);
    
    expect(mockFetchCalls.length).toBe(1);
    expect(mockFetchCalls[0].url).toBe('http://localhost:8787/marcar-cheio');
    expect(mockFetchCalls[0].options.method).toBe('POST');
    
    const body = JSON.parse(mockFetchCalls[0].options.body);
    expect(body.banco).toBe(banco);
    expect(body.percentualLeituras).toBe(70);
  });
});

describe('getUsoBanco', () => {
  test('deve retornar uso do banco padrão quando não especificado', () => {
    const uso = getUsoBanco();
    expect(uso.banco).toBe('firestore-default');
    expect(uso.leituras).toBe(0);
    expect(uso.escritas).toBe(0);
  });
  
  test('deve retornar uso específico de um banco', () => {
    const banco = 'd1';
    registrarUsoBanco(banco, 1000, 100);
    
    const uso = getUsoBanco(banco);
    expect(uso.banco).toBe(banco);
    expect(uso.leituras).toBe(1000);
    expect(uso.escritas).toBe(100);
  });
  
  test('deve retornar limites corretos para cada tipo de banco', () => {
    const firestoreBanco = getUsoBanco('firestore-b');
    expect(firestoreBanco.limiteLeituras).toBe(50000);
    expect(firestoreBanco.limiteEscritas).toBe(20000);
    
    const d1Banco = getUsoBanco('d1');
    expect(d1Banco.limiteLeituras).toBe(5000000);
    expect(d1Banco.limiteEscritas).toBe(100000);
    
    const cofreSqlBanco = getUsoBanco('cofresql');
    expect(cofreSqlBanco.limiteLeituras).toBe(50000000);
    expect(cofreSqlBanco.limiteEscritas).toBe(10000000);
  });
});

describe('getBancosUsoGeral', () => {
  test('deve retornar uso de todos os bancos', () => {
    // Registrar uso em alguns bancos
    registrarUsoBanco('firestore-b', 1000, 100);
    registrarUsoBanco('d1', 5000, 50);
    
    const bancos = getBancosUsoGeral();
    
    expect(bancos.length).toBe(Object.keys(BANK_LIMITS).length);
    
    // Verificar se todos os bancos estão presentes
    const bancosIds = bancos.map(b => b.banco);
    expect(bancosIds).toContain('firestore-default');
    expect(bancosIds).toContain('firestore-b');
    expect(bancosIds).toContain('firestore-c');
    expect(bancosIds).toContain('d1');
    expect(bancosIds).toContain('cofresql');
    
    // Verificar valores específicos
    const firestoreBanco = bancos.find(b => b.banco === 'firestore-b');
    expect(firestoreBanco.reads).toBe(1000);
    expect(firestoreBanco.writes).toBe(100);
    
    const d1Banco = bancos.find(b => b.banco === 'd1');
    expect(d1Banco.reads).toBe(5000);
    expect(d1Banco.writes).toBe(50);
  });
});

describe('BANK_LIMITS', () => {
  test('deve ter limites corretos para cada banco', () => {
    expect(BANK_LIMITS['firestore-default']).toEqual({
      reads: 50000,
      writes: 20000,
      warnThreshold: 0.7
    });
    
    expect(BANK_LIMITS['firestore-b']).toEqual({
      reads: 50000,
      writes: 20000,
      warnThreshold: 0.7
    });
    
    expect(BANK_LIMITS['firestore-c']).toEqual({
      reads: 50000,
      writes: 20000,
      warnThreshold: 0.7
    });
    
    expect(BANK_LIMITS['d1']).toEqual({
      reads: 5000000,
      writes: 100000,
      warnThreshold: 0.7
    });
    
    expect(BANK_LIMITS['cofresql']).toEqual({
      reads: 50000000,
      writes: 10000000,
      warnThreshold: 0.7
    });
  });
});
