'use strict';

const { 
  PLANOS, 
  CUSTO_MODELO, 
  calcularCustoMensagem, 
  getPlanoUsuario, 
  registrarUsoMensagem, 
  verificarCreditos, 
  consumirCreditos, 
  getUsoAtual, 
  getPlanoInfo, 
  mesVirou 
} = require('../../lib/cortex-planos');

// Mock do Firestore
const mockFirestore = {
  collection: (path) => ({
    doc: (docId) => ({
      get: () => Promise.resolve({
        data: () => mockFirestoreData[path]?.[docId] || null
      }),
      set: (data, options) => {
        if (!mockFirestoreData[path]) mockFirestoreData[path] = {};
        if (!mockFirestoreData[path][docId]) mockFirestoreData[path][docId] = {};
        
        // Simula merge
        if (options?.merge) {
          Object.assign(mockFirestoreData[path][docId], data);
        } else {
          mockFirestoreData[path][docId] = data;
        }
        
        return Promise.resolve();
      }
    })
  })
};

let mockFirestoreData = {};

// Função auxiliar para resetar o mock
function resetMock() {
  mockFirestoreData = {};
}

describe('Sistema de Planos do Cortex', () => {
  beforeEach(() => {
    resetMock();
  });

  describe('PLANOS e CUSTO_MODELO', () => {
    test('Deve ter todos os planos definidos', () => {
      expect(PLANOS).toHaveProperty('gratis');
      expect(PLANOS).toHaveProperty('basico');
      expect(PLANOS).toHaveProperty('pro');
      expect(PLANOS).toHaveProperty('negocio');
      expect(PLANOS).toHaveProperty('revenda');
    });

    test('Deve ter custo definido para cada modelo', () => {
      expect(CUSTO_MODELO).toHaveProperty('rapido');
      expect(CUSTO_MODELO).toHaveProperty('forte');
      expect(CUSTO_MODELO).toHaveProperty('avancado');
      expect(CUSTO_MODELO).toHaveProperty('premium');
    });
  });

  describe('calcularCustoMensagem', () => {
    test('Deve calcular custo corretamente para modelo rápido', () => {
      const custo = calcularCustoMensagem('rapido', 1000);
      expect(custo).toBe(1);
    });

    test('Deve calcular custo corretamente para modelo forte', () => {
      const custo = calcularCustoMensagem('forte', 1000);
      expect(custo).toBe(3);
    });

    test('Deve arredondar para cima a cada 1000 tokens', () => {
      const custo1 = calcularCustoMensagem('rapido', 500);
      const custo2 = calcularCustoMensagem('rapido', 1500);
      expect(custo1).toBe(1);
      expect(custo2).toBe(2);
    });

    test('Deve retornar 0 para modelo desconhecido', () => {
      const custo = calcularCustoMensagem('desconhecido', 1000);
      expect(custo).toBe(0);
    });
  });

  describe('verificarCreditos', () => {
    const uid = 'test-user-123';
    const db = mockFirestore;
    
    test('Deve permitir uso de modelo rápido no plano grátis', async () => {
      const resultado = await verificarCreditos(uid, 'rapido', 1000, db, 'gratis');
      expect(resultado.permitido).toBe(true);
    });

    test('Deve negar uso de modelo forte no plano grátis', async () => {
      const resultado = await verificarCreditos(uid, 'forte', 1000, db, 'gratis');
      expect(resultado.permitido).toBe(false);
      expect(resultado.motivo).toBe('Modelo não permitido para seu plano');
    });

    test('Deve respeitar limite diário do plano grátis', async () => {
      // Simula 20 mensagens já usadas hoje
      const hoje = new Date();
      const mesAno = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
      const hojeStr = hoje.toISOString().split('T')[0];
      
      mockFirestoreData[`cortexClientes/${uid}/uso/${mesAno}`] = {
        [hojeStr]: { mensagens: 20, tokens: 20000 }
      };
      
      const resultado = await verificarCreditos(uid, 'rapido', 1000, db, 'gratis');
      expect(resultado.permitido).toBe(false);
      expect(resultado.motivo).toBe('Limite diário de mensagens atingido');
    });

    test('Deve verificar créditos mensais para planos pagos', async () => {
      // Simula 1500 créditos usados no plano básico
      const hoje = new Date();
      const mesAno = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
      
      mockFirestoreData[`cortexClientes/${uid}/uso/${mesAno}`] = {
        'total': { mensagens: 500, tokens: 1500 }
      };
      
      // Tenta usar mais 1 crédito no plano básico (total 1501 > 1500)
      const resultado = await verificarCreditos(uid, 'rapido', 1, db, 'basico');
      expect(resultado.permitido).toBe(false);
      expect(resultado.motivo).toBe('Créditos insuficientes para este mês');
      expect(resultado.creditosRestantes).toBe(0);
    });
  });

  describe('consumirCreditos', () => {
    const uid = 'test-user-123';
    const db = mockFirestore;
    
    test('Deve consumir créditos com sucesso', async () => {
      const resultado = await consumirCreditos(uid, 'rapido', 1000, db, 'gratis');
      expect(resultado.permitido).toBe(true);
      expect(resultado.mensagem).toBe('Uso registrado com sucesso');
      
      // Verifica se o uso foi registrado
      const uso = await getUsoAtual(uid, db);
      expect(uso.hoje.mensagens).toBe(1);
      expect(uso.hoje.tokens).toBe(1000);
    });

    test('Deve negar consumo quando créditos insuficientes', async () => {
      // Simula limite atingido
      const hoje = new Date();
      const mesAno = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
      const hojeStr = hoje.toISOString().split('T')[0];
      
      mockFirestoreData[`cortexClientes/${uid}/uso/${mesAno}`] = {
        [hojeStr]: { mensagens: 20, tokens: 20000 },
        'total': { mensagens: 20, tokens: 20000 }
      };
      
      const resultado = await consumirCreditos(uid, 'rapido', 1000, db, 'gratis');
      expect(resultado.permitido).toBe(false);
      expect(resultado.motivo).toBe('Limite diário de mensagens atingido');
    });
  });

  describe('getUsoAtual', () => {
    const uid = 'test-user-123';
    const db = mockFirestore;
    
    test('Deve retornar uso atual do usuário', async () => {
      // Simula dados de uso
      const hoje = new Date();
      const mesAno = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
      const hojeStr = hoje.toISOString().split('T')[0];
      
      mockFirestoreData[`cortexClientes/${uid}/uso/${mesAno}`] = {
        [hojeStr]: { mensagens: 5, tokens: 5000 },
        'total': { mensagens: 10, tokens: 10000 }
      };
      
      const uso = await getUsoAtual(uid, db);
      expect(uso.hoje.mensagens).toBe(5);
      expect(uso.hoje.tokens).toBe(5000);
      expect(uso.mes.mensagens).toBe(10);
      expect(uso.mes.tokens).toBe(10000);
    });

    test('Deve retornar 0 quando não há uso', async () => {
      const uso = await getUsoAtual(uid, db);
      expect(uso.hoje.mensagens).toBe(0);
      expect(uso.hoje.tokens).toBe(0);
      expect(uso.mes.mensagens).toBe(0);
      expect(uso.mes.tokens).toBe(0);
    });
  });

  describe('mesVirou', () => {
    test('Deve detectar quando o mês virou', () => {
      // Simula primeiro dia do mês
      const primeiroDia = new Date('2023-06-01T00:00:00.000Z');
      expect(mesVirou(primeiroDia.getTime())).toBe(true);
      
      // Simula dia qualquer do mês
      const diaQualquer = new Date('2023-06-15T12:30:45.000Z');
      expect(mesVirou(diaQualquer.getTime())).toBe(false);
    });
  });

  describe('getPlanoInfo', () => {
    test('Deve retornar informações do plano', () => {
      const info = getPlanoInfo('gratis');
      expect(info.nome).toBe('Grátis');
      expect(info.mensagensDiarias).toBe(20);
      expect(info.creditosMensais).toBe(0);
    });

    test('Deve retornar null para plano desconhecido', () => {
      const info = getPlanoInfo('desconhecido');
      expect(info).toBe(null);
    });
  });
});
