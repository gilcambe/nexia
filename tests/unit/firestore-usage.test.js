'use strict';

const {
  registrarUsoBanco,
  getUsoBanco,
  getBancosUsoGeral,
  BANK_LIMITS,
  usoDiarioBancos
} = require('../../lib/firebase-lite/firestore');

// Limpa o estado antes de cada teste
beforeEach(() => {
  usoDiarioBancos.clear();
});

describe('Contador de uso por banco', () => {
  test('deve registrar uso de leituras', () => {
    registrarUsoBanco('firestore-default', 5, 0);
    
    const uso = getUsoBanco('firestore-default');
    expect(uso.leituras).toBe(5);
    expect(uso.escritas).toBe(0);
    expect(uso.status).toBe('ativo');
  });

  test('deve registrar uso de escritas', () => {
    registrarUsoBanco('firestore-b', 0, 3);
    
    const uso = getUsoBanco('firestore-b');
    expect(uso.leituras).toBe(0);
    expect(uso.escritas).toBe(3);
    expect(uso.status).toBe('ativo');
  });

  test('deve acumular múltiplas operações', () => {
    registrarUsoBanco('firestore-c', 10, 5);
    registrarUsoBanco('firestore-c', 5, 2);
    
    const uso = getUsoBanco('firestore-c');
    expect(uso.leituras).toBe(15);
    expect(uso.escritas).toBe(7);
  });

  test('deve usar limite padrão para banco desconhecido', () => {
    registrarUsoBanco('banco-desconhecido', 1000, 500);
    
    const uso = getUsoBanco('banco-desconhecido');
    expect(uso.limiteLeituras).toBe(BANK_LIMITS['firestore-default'].reads);
    expect(uso.limiteEscritas).toBe(BANK_LIMITS['firestore-default'].writes);
  });

  test('deve retornar status vazio quando não houver uso', () => {
    const uso = getUsoBanco('firestore-d1');
    expect(uso.leituras).toBe(0);
    expect(uso.escritas).toBe(0);
    expect(uso.status).toBe('ativo');
  });
});

describe('Geral de uso por bancos', () => {
  test('deve retornar uso de todos os bancos', () => {
    registrarUsoBanco('firestore-default', 100, 50);
    registrarUsoBanco('firestore-b', 200, 100);
    registrarUsoBanco('d1', 1000, 500);
    
    const geral = getBancosUsoGeral();
    expect(geral).toHaveLength(5); // 5 bancos definidos
    
    const firestoreDefault = geral.find(b => b.banco === 'firestore-default');
    expect(firestoreDefault.reads).toBe(100);
    expect(firestoreDefault.writes).toBe(50);
    
    const firestoreB = geral.find(b => b.banco === 'firestore-b');
    expect(firestoreB.reads).toBe(200);
    expect(firestoreB.writes).toBe(100);
    
    const d1 = geral.find(b => b.banco === 'd1');
    expect(d1.reads).toBe(1000);
    expect(d1.writes).toBe(500);
  });
});
