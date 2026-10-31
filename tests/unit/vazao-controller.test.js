'use strict';

// Testes unitários para VazaoController
const { VazaoController } = require('../../src/durable/VazaoController.js');

class MockStorage {
  constructor() {
    this.data = new Map();
  }
  
  async put(key, value) {
    this.data.set(key, value);
  }
  
  async get(key) {
    return this.data.get(key);
  }
  
  async list(options = {}) {
    const results = [];
    for (const [key] of this.data) {
      if (options.prefix && !key.startsWith(options.prefix)) continue;
      results.push({ name: key });
    }
    return { keys: results };
  }
}

class MockState {
  constructor() {
    this.storage = new MockStorage();
  }
}

describe('VazaoController', () => {
  let vazaoController;
  
  beforeEach(() => {
    const state = new MockState();
    vazaoController = new VazaoController(state);
  });
  
  test('deve registrar uso do banco corretamente', () => {
    const resultado = vazaoController.registrar('firestore-b', 10, 5);
    expect(resultado.leituras).toBe(10);
    expect(resultado.escritas).toBe(5);
    expect(resultado.status).toBe('ativo');
  });
  
  test('deve acumular uso do mesmo banco', () => {
    vazaoController.registrar('firestore-b', 10, 5);
    const resultado = vazaoController.registrar('firestore-b', 5, 2);
    expect(resultado.leituras).toBe(15);
    expect(resultado.escritas).toBe(7);
  });
  
  test('deve verificar limite corretamente', () => {
    // Firestore: 50k leituras, 20k escritas, 70% = 35k/14k
    vazaoController.registrar('firestore-b', 35000, 14000);
    const limite = vazaoController.verificarLimite('firestore-b');
    expect(limite.quaseCheio).toBe(true);
    expect(limite.leituras).toBe(35000);
    expect(limite.escritas).toBe(14000);
  });
  
  test('deve trocar banco quando atingir 70%', () => {
    vazaoController.registrar('firestore-b', 35000, 14000);
    const proximo = vazaoController.proximoBanco();
    expect(proximo).toBe('firestore-c');
    expect(vazaoController.obterBancoAtual()).toBe('firestore-c');
  });
  
  test('deve retornar uso diário', () => {
    vazaoController.registrar('firestore-b', 1000, 500);
    const uso = vazaoController.obterUsoDiario('firestore-b');
    expect(uso.leituras).toBe(1000);
    expect(uso.escritas).toBe(500);
  });
  
  test('deve retornar uso de todos os bancos', () => {
    vazaoController.registrar('firestore-b', 1000, 500);
    vazaoController.registrar('firestore-c', 2000, 1000);
    const usoTodos = vazaoController.obterUsoTodosBancos();
    expect(usoTodos.length).toBe(4);
    expect(usoTodos.find(b => b.banco === 'firestore-b').leituras).toBe(1000);
    expect(usoTodos.find(b => b.banco === 'firestore-c').leituras).toBe(2000);
  });
  
  test('deve detectar bancos quase cheios', () => {
    // Simular um banco quase cheio
    vazaoController.registrar('firestore-b', 35000, 14000);
    const alerta = vazaoController.checarBancosQuaseCheios();
    expect(alerta).toBeTruthy();
    expect(alerta.bancoCheio).toBe('firestore-b');
    expect(alerta.proximoBanco).toBe('firestore-c');
    expect(alerta.alerta.tipo).toBe('sentinel');
  });
  
  test('deve retornar null quando nenhum banco está quase cheio', () => {
    vazaoController.registrar('firestore-b', 1000, 500);
    const alerta = vazaoController.checarBancosQuaseCheios();
    expect(alerta).toBeNull();
  });
});