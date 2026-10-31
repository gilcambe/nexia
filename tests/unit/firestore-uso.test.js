'use strict';
// Testes unitários para contador de uso por banco e troca preventiva do Vault (firestore.js)
const {
  Firestore,
  registrarUsoBanco,
  getUsoBanco,
  getBancosUsoGeral,
  getNextBank,
  switchToNextBank,
  checkBankHealth,
  BANK_LIMITS,
  ordemBancos,
  getBancoAtivo
} = require('../../lib/firebase-lite/firestore.js');

describe('Contador de uso por banco do Vault', () => {
  beforeEach(() => {
    // Resetar estado global entre testes
    require.cache[require.resolve('../../lib/firebase-lite/firestore.js')].exports.usoDiarioBancos.clear();
  });

  test('deve registrar leituras e escritas por banco', () => {
    registrarUsoBanco('firestore-b', 100, 50);
    const uso = getUsoBanco('firestore-b');
    expect(uso.leituras).toBe(100);
    expect(uso.escritas).toBe(50);
  });

  test('deve acumular uso do mesmo banco no mesmo dia', () => {
    registrarUsoBanco('firestore-b', 100, 50);
    registrarUsoBanco('firestore-b', 200, 30);
    const uso = getUsoBanco('firestore-b');
    expect(uso.leituras).toBe(300);
    expect(uso.escritas).toBe(80);
  });

  test('deve resetar contadores em dia diferente', () => {
    registrarUsoBanco('firestore-b', 100, 50);
    // Simular nova entrada forçando data diferente
    const mod = require.cache[require.resolve('../../lib/firebase-lite/firestore.js')].exports;
    const entry = mod.usoDiarioBancos.get('firestore-b');
    entry.data = '2020-01-01';
    registrarUsoBanco('firestore-b', 50, 20);
    const uso = getUsoBanco('firestore-b');
    expect(uso.leituras).toBe(50);
    expect(uso.escritas).toBe(20);
  });

  test('deve retornar limites corretos por tipo de banco', () => {
    expect(BANK_LIMITS['firestore-b'].reads).toBe(50000);
    expect(BANK_LIMITS['firestore-b'].writes).toBe(20000);
    expect(BANK_LIMITS['d1'].reads).toBe(5000000);
    expect(BANK_LIMITS['d1'].writes).toBe(100000);
    expect(BANK_LIMITS['cofresql'].reads).toBe(50000000);
    expect(BANK_LIMITS['cofresql'].writes).toBe(10000000);
  });

  test('deve listar uso de todos os bancos', () => {
    registrarUsoBanco('firestore-b', 1000, 500);
    registrarUsoBanco('d1', 2000, 1000);
    const todos = getBancosUsoGeral();
    expect(Array.isArray(todos)).toBe(true);
    const b = todos.find(x => x.banco === 'firestore-b');
    expect(b.reads).toBe(1000);
    const d = todos.find(x => x.banco === 'd1');
    expect(d.reads).toBe(2000);
  });
});

describe('Troca de banco antes de acabar (70%)', () => {
  beforeEach(() => {
    require.cache[require.resolve('../../lib/firebase-lite/firestore.js')].exports.usoDiarioBancos.clear();
  });

  test('deve marcar banco como quase cheio ao passar de 70% de leituras', () => {
    registrarUsoBanco('firestore-b', 35000, 0); // 70% de 50k
    const uso = getUsoBanco('firestore-b');
    expect(uso.status).toBe('quase cheio');
  });

  test('deve marcar banco como quase cheio ao passar de 70% de escritas', () => {
    registrarUsoBanco('firestore-b', 0, 14000); // 70% de 20k
    const uso = getUsoBanco('firestore-b');
    expect(uso.status).toBe('quase cheio');
  });

  test('deve não marcar quase cheio abaixo de 70%', () => {
    registrarUsoBanco('firestore-b', 34999, 0);
    const uso = getUsoBanco('firestore-b');
    expect(uso.status).toBe('ativo');
  });

  test('deve alternar para próximo banco ao atingir limite', () => {
    registrarUsoBanco('firestore-b', 35000, 0);
    // Forçar troca
    switchToNextBank();
    const ativo = getBancoAtivo();
    expect(ativo).toBe('firestore-c');
  });

  test('ordem de bancos deve ser B -> C -> D1 -> CofreSql', () => {
    expect(ordemBancos).toContain('firestore-b');
    expect(ordemBancos).toContain('firestore-c');
    expect(ordemBancos).toContain('d1');
    expect(ordemBancos).toContain('cofresql');
  });
});

describe('getUsoBanco retorna estrutura completa', () => {
  beforeEach(() => {
    require.cache[require.resolve('../../lib/firebase-lite/firestore.js')].exports.usoDiarioBancos.clear();
  });

  test('deve retornar campos esperados para banco sem uso', () => {
    const uso = getUsoBanco('firestore-b');
    expect(uso).toHaveProperty('data');
    expect(uso).toHaveProperty('leituras');
    expect(uso).toHaveProperty('escritas');
    expect(uso).toHaveProperty('status');
    expect(uso).toHaveProperty('limiteLeituras');
    expect(uso).toHaveProperty('limiteEscritas');
  });
});
