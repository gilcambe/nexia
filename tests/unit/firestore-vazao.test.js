'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const R = p => fs.readFileSync(path.join(__dirname, '..', '..', p), 'utf8');

// Importar o módulo de firestore para testar as funções de vazão
const firestoreModule = require('../../lib/firebase-lite/firestore.js');

// Mock para simular o ambiente de testes
process.env.NODE_ENV = 'test';

// Resetar o estado antes de cada teste
const resetState = () => {
  firestoreModule.usoDiarioBancos.clear();
  firestoreModule.bancoAtual = 'firestore-default';
};

test('VAZAO-CONTADOR: registrarUsoBanco incrementa corretamente as operações', () => {
  resetState();
  
  // Registrar operações no banco padrão
  firestoreModule.registrarUsoBanco('firestore-default', 10, 5);
  firestoreModule.registrarUsoBanco('firestore-default', 5, 3);
  
  // Verificar se as operações foram registradas
  const uso = firestoreModule.getUsoBanco('firestore-default');
  assert.strictEqual(uso.leituras, 15);
  assert.strictEqual(uso.escritas, 8);
  
  // Registrar em outro banco
  firestoreModule.registrarUsoBanco('firestore-b', 20, 10);
  const usoB = firestoreModule.getUsoBanco('firestore-b');
  assert.strictEqual(usoB.leituras, 20);
  assert.strictEqual(usoB.escritas, 10);
});

test('VAZAO-LIMITE: isBancoQuaseCheio detecta corretamente quando atinge 70%', () => {
  resetState();
  
  // Limite do Firestore: 50k leituras / 20k escritas, 70% = 35k/14k
  const limite = firestoreModule.BANK_LIMITS['firestore-default'];
  
  // Testar abaixo do limite
  firestoreModule.registrarUsoBanco('firestore-default', 30000, 10000);
  assert.strictEqual(firestoreModule.isBancoQuaseCheio('firestore-default'), false);
  
  // Testar exatamente no limite
  firestoreModule.registrarUsoBanco('firestore-default', 35000, 14000);
  assert.strictEqual(firestoreModule.isBancoQuaseCheio('firestore-default'), true);
  
  // Testar acima do limite
  firestoreModule.registrarUsoBanco('firestore-default', 40000, 15000);
  assert.strictEqual(firestoreModule.isBancoQuaseCheio('firestore-default'), true);
});

test('VAZAO-RODIZIO: getNextBank retorna o próximo banco na sequência correta', () => {
  resetState();
  
  // Testar sequência completa
  firestoreModule.bancoAtual = 'firestore-default';
  assert.strictEqual(firestoreModule.getNextBank(), 'firestore-b');
  
  firestoreModule.bancoAtual = 'firestore-b';
  assert.strictEqual(firestoreModule.getNextBank(), 'firestore-c');
  
  firestoreModule.bancoAtual = 'firestore-c';
  assert.strictEqual(firestoreModule.getNextBank(), 'd1');
  
  firestoreModule.bancoAtual = 'd1';
  assert.strictEqual(firestoreModule.getNextBank(), 'cofresql');
  
  // Testar último banco (volta para o primeiro)
  firestoreModule.bancoAtual = 'cofresql';
  assert.strictEqual(firestoreModule.getNextBank(), 'firestore-default');
});

test('VAZAO-TROCA: switchToNextBank troca corretamente o banco ativo', () => {
  resetState();
  
  // Trocar de banco padrão para B
  const novoBanco = firestoreModule.switchToNextBank();
  assert.strictEqual(novoBanco, 'firestore-b');
  assert.strictEqual(firestoreModule.bancoAtual, 'firestore-b');
  
  // Trocar de B para C
  const novoBanco2 = firestoreModule.switchToNextBank();
  assert.strictEqual(novoBanco2, 'firestore-c');
  assert.strictEqual(firestoreModule.bancoAtual, 'firestore-c');
});

test('VAZAO-ORDENACAO: ordem dos bancos segue a sequência B → C → D1 → CofreSql', () => {
  resetState();
  
  // Verificar se a ordem está correta
  assert.deepStrictEqual(firestoreModule.ordemBancos, [
    'firestore-default',
    'firestore-b',
    'firestore-c',
    'd1',
    'cofresql'
  ]);
  
  // Verificar se o banco inicial é o padrão
  assert.strictEqual(firestoreModule.bancoAtual, 'firestore-default');
});