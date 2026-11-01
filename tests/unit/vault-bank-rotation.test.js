'use strict';

// Testes para a funcionalidade de troca de banco do Vault
// Verifica se o sistema troca corretamente de banco quando atinge 70% do limite

const { getNextBank, switchToNextBank, checkBankHealth, BANCO_RODIZIO } = require('../../lib/firebase-lite/firestore.js');

// Mockar o console para capturar logs
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const logs = [];

beforeEach(() => {
  console.log = (...args) => {
    logs.push({ type: 'log', args });
    originalConsoleLog(...args);
  };
  console.warn = (...args) => {
    logs.push({ type: 'warn', args });
    originalConsoleWarn(...args);
  };
  logs.length = 0;
});

afterEach(() => {
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
});

describe('Troca de banco do Vault', () => {
  test('deve retornar o próximo banco disponível', () => {
    // Resetar o índice para testar
    const originalIndex = global.currentBancoIndex;
    global.currentBancoIndex = 0;
    
    const nextBank = getNextBank();
    expect(BANCO_RODIZIO).toContain(nextBank);
    
    // Restaurar o índice original
    global.currentBancoIndex = originalIndex;
  });
  
  test('deve trocar para o próximo banco na ordem correta', () => {
    // Resetar o índice para testar
    const originalIndex = global.currentBancoIndex;
    global.currentBancoIndex = 0;
    
    const primeiroBanco = BANCO_RODIZIO[0];
    const proximoBanco = getNextBank();
    
    expect(proximoBanco).toBe(primeiroBanco);
    
    // Testar troca sequencial
    const segundoBanco = getNextBank();
    expect(segundoBanco).toBe(BANCO_RODIZIO[1]);
    
    const terceiroBanco = getNextBank();
    expect(terceiroBanco).toBe(BANCO_RODIZIO[2]);
    
    const quartoBanco = getNextBank();
    expect(quartoBanco).toBe(BANCO_RODIZIO[3]);
    
    // Voltar ao primeiro
    const primeiroNovamente = getNextBank();
    expect(primeiroNovamente).toBe(BANCO_RODIZIO[0]);
    
    // Restaurar o índice original
    global.currentBancoIndex = originalIndex;
  });
  
  test('deve lidar com todos os bancos quase cheios', () => {
    // Resetar o índice para testar
    const originalIndex = global.currentBancoIndex;
    global.currentBancoIndex = 0;
    
    // Simular que todos os bancos estão quase cheios
    BANCO_RODIZIO.forEach(banco => {
      global[`checkBankHealth_${banco}`] = () => false;
    });
    
    // Mockar a função checkBankHealth
    const originalCheckBankHealth = checkBankHealth;
    checkBankHealth = () => false;
    
    const banco = getNextBank();
    expect(BANCO_RODIZIO).toContain(banco);
    
    // Verificar se houve um aviso
    const warningLogs = logs.filter(log => log.type === 'warn');
    expect(warningLogs.length).toBeGreaterThan(0);
    expect(warningLogs[0].args[0]).toContain('Todos os bancos estão quase cheios');
    
    // Restaurar funções
    checkBankHealth = originalCheckBankHealth;
    global.currentBancoIndex = originalIndex;
  });
  
  test('deve trocar explicitamente de banco', () => {
    // Resetar o índice para testar
    const originalIndex = global.currentBancoIndex;
    global.currentBancoIndex = 0;
    
    const bancoAnterior = BANCO_RODIZIO[0];
    const bancoNovo = switchToNextBank();
    
    expect(bancoNovo).toBe(BANCO_RODIZIO[1]);
    expect(logs.some(log => 
      log.type === 'log' && 
      log.args[0].includes(`Troca preventiva de banco: ${bancoAnterior} -> ${bancoNovo}`)
    )).toBe(true);
    
    // Restaurar o índice original
    global.currentBancoIndex = originalIndex;
  });
  
  test('deve verificar a saúde do banco corretamente', () => {
    // Mockar o getUsoBanco para retornar status diferente
    const originalGetUsoBanco = global.getUsoBanco;
    
    // Testar banco saudável
    global.getUsoBanco = (banco) => ({
      status: 'ativo',
      leituras: 10000,
      escritas: 5000
    });
    
    expect(checkBankHealth('firestore-b')).toBe(true);
    
    // Testar banco quase cheio
    global.getUsoBanco = (banco) => ({
      status: 'quase cheio',
      leituras: 40000,
      escritas: 15000
    });
    
    expect(checkBankHealth('firestore-b')).toBe(false);
    
    // Restaurar função original
    global.getUsoBanco = originalGetUsoBanco;
  });
});
