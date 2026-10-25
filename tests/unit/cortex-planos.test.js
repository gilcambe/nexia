'use strict';
const { strict: assert } = require('node:assert');
const { describe: describe, it: it } = require('node:test');
const cortexPlanos = require('../../lib/cortex-planos');

// Simulação de objeto de armazenamento
const mockArmazenamento = {
  incrementar: async (path, dados) => {
    // Simula o armazenamento incrementando os dados
    return Promise.resolve();
  },
  collection: (path) => ({
    doc: (id) => ({
      get: async () => {
        // Simula dados de uso
        if (id === 'total') {
          return { data: () => ({ tokens: 1000, mensagens: 10 }) };
        }
        return { data: () => ({ mensagens: 5, tokens: 500 }) };
      }
    })
  })
};

// Simulação de objeto de banco de dados
const mockDb = {
  collection: (path) => ({
    doc: (id) => ({
      get: async () => {
        // Simula dados de uso
        if (id === 'total') {
          return { data: () => ({ tokens: 1000, mensagens: 10 }) };
        }
        return { data: () => ({ mensagens: 5, tokens: 500 }) };
      }
    })
  })
};

describe('cortex-planos', () => {
  describe('calcularCustoMensagem', () => {
    it('calcula custo corretamente para modelo rápido', () => {
      const custo = cortexPlanos.calcularCustoMensagem('rapido', 1000);
      assert.strictEqual(custo, 1);
    });
    
    it('calcula custo corretamente para modelo forte', () => {
      const custo = cortexPlanos.calcularCustoMensagem('forte', 1000);
      assert.strictEqual(custo, 3);
    });
    
    it('calcula custo corretamente para modelo avançado', () => {
      const custo = cortexPlanos.calcularCostaMensagem('avançado', 1000);
      assert.strictEqual(custo, 5);
    });
    
    it('calcula custo corretamente para modelo premium', () => {
      const custo = cortexPlanos.calcularCustoMensagem('premium', 1000);
      assert.strictEqual(custo, 10);
    });
    
    it('arredonda para cima a cada 1000 tokens', () => {
      const custo = cortexPlanos.calcularCustoMensagem('forte', 1500);
      assert.strictEqual(custo, 5); // 1500 * 3 / 1000 = 4.5 -> arredonda para 5
    });
  });
  
  describe('verificarCreditos', () => {
    it('permite uso de modelo rápido no plano grátis', async () => {
      const resultado = await cortexPlanos.verificarCreditos('user123', 'rapido', 1000, mockArmazenamento, 'gratis');
      assert.strictEqual(resultado.permitido, true);
    });
    
    it('bloqueia modelo forte no plano grátis', async () => {
      const resultado = await cortexPlanos.verificarCreditos('user123', 'forte', 1000, mockArmazenamento, 'gratis');
      assert.strictEqual(resultado.permitido, false);
      assert.strictEqual(resultado.motivo, 'Modelo não permitido para seu plano');
    });
    
    it('respeita limite diário do plano grátis', async () => {
      // Simular que já usou 20 mensagens hoje
      mockArmazenamento.collection = (path) => ({
        doc: (id) => ({
          get: async () => {
            if (id === 'total') {
              return { data: () => ({ tokens: 1000, mensagens: 10 }) };
            }
            return { data: () => ({ mensagens: 20, tokens: 1000 }) };
          }
        })
      });
      
      const resultado = await cortexPlanos.verificarCreditos('user123', 'rapido', 1000, mockArmazenamento, 'gratis');
      assert.strictEqual(resultado.permitido, false);
      assert.strictEqual(resultado.motivo, 'Limite diário de mensagens atingido');
    });
    
    it('verifica créditos mensais para plano básico', async () => {
      // Simular que já usou 1400 créditos e a mensagem custa 100
      mockArmazenamento.collection = (path) => ({
        doc: (id) => ({
          get: async () => {
            if (id === 'total') {
              return { data: () => ({ tokens: 1400, mensagens: 10 }) };
            }
            return { data: () => ({ mensagens: 5, tokens: 500 }) };
          }
        })
      });
      
      const resultado = await cortexPlanos.verificarCreditos('user123', 'forte', 1000, mockArmazenamento, 'basico');
      assert.strictEqual(resultado.permitido, false);
      assert.strictEqual(resultado.motivo, 'Créditos insuficientes para este mês');
      assert.strictEqual(resultado.creditosRestantes, 100);
    });
  });
  
  describe('consumirCreditos', () => {
    it('registra o uso ao consumir créditos', async () => {
      let chamadaIncrementar = false;
      mockArmazenamento.incrementar = async (path, dados) => {
        chamadaIncrementar = true;
        assert.strictEqual(path, 'cortexClientes/user123/uso/2024-01/2024-01-15');
        assert.deepStrictEqual(dados, {
          mensagens: 1,
          tokens: 1000,
          modelo: 'rapido',
          timestamp: new Date().toISOString()
        });
        return Promise.resolve();
      };
      
      const resultado = await cortexPlanos.consumirCreditos('user123', 'rapido', 1000, mockDb, 'gratis');
      assert.strictEqual(resultado.permitido, true);
      assert.strictEqual(chamadaIncrementar, true);
    });
  });
  
  describe('getUsoAtual', () => {
    it('retorna uso atual do usuário', async () => {
      const uso = await cortexPlanos.getUsoAtual('user123', mockDb);
      assert.deepStrictEqual(uso, {
        hoje: {
          mensagens: 5,
          tokens: 500
        },
        mes: {
          mensagens: 10,
          tokens: 1000
        }
      });
    });
  });
  
  describe('getPlanoInfo', () => {
    it('retorna informações do plano', () => {
      const info = cortexPlanos.getPlanoInfo('gratis');
      assert.strictEqual(info.nome, 'Grátis');
      assert.strictEqual(info.mensagensDiarias, 20);
      assert.strictEqual(info.creditosMensais, 0);
      assert.deepStrictEqual(info.modelosPermitidos, ['rapido']);
    });
    
    it('retorna null para plano inexistente', () => {
      const info = cortexPlanos.getPlanoInfo('inexistente');
      assert.strictEqual(info, null);
    });
  });
  
  describe('mesVirou', () => {
    it('detecta quando o mês virou', () => {
      // Primeiro dia do mês
      const dataVirada = new Date('2024-01-01T00:00:00.000Z');
      assert.strictEqual(cortexPlanos.mesVirou(dataVirada.getTime()), true);
      
      // Dia 2 do mês
      const dataNormal = new Date('2024-01-02T00:00:00.000Z');
      assert.strictEqual(cortexPlanos.mesVirou(dataNormal.getTime()), false);
    });
  });
});