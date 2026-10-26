const metricsService = require('../../src/services/metricsService');

// Mock para fetchJson para simular respostas de API
jest.mock('../../src/services/metricsService');
const originalFetchJson = metricsService.fetchJson;

beforeEach(() => {
  // Restaurar a função original antes de cada teste
  metricsService.fetchJson = originalFetchJson;
});

describe('metricsService', () => {
  describe('estadoCortex', () => {
    it('deve retornar estado online se dados recentes', async () => {
      const agora = new Date().toISOString();
      const umaHoraAtras = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      
      metricsService.fetchJson = jest.fn().mockResolvedValue([
        { timestamp: umaHoraAtras, status: 'online' }
      ]);
      
      const resultado = await metricsService.estadoCortex();
      
      expect(resultado).toEqual({
        estado: 'online',
        ultimaAtualizacao: umaHoraAtras
      });
    });
    
    it('deve retornar estado degradado se dados antigos', async () => {
      const antigo = new Date(Date.now() - 20 * 60 * 1000).toISOString();
      
      metricsService.fetchJson = jest.fn().mockResolvedValue([
        { timestamp: antigo, status: 'online' }
      ]);
      
      const resultado = await metricsService.estadoCortex();
      
      expect(resultado).toEqual({
        estado: 'degradado',
        ultimaAtualizacao: antigo
      });
    });
    
    it('deve retornar estado offline se sem dados', async () => {
      metricsService.fetchJson = jest.fn().mockResolvedValue(null);
      
      const resultado = await metricsService.estadoCortex();
      
      expect(resultado).toEqual({
        estado: 'offline',
        ultimaAtualizacao: expect.any(String)
      });
    });
  });
  
  describe('tempoMedioRespostaUltimaHora', () => {
    it('deve calcular tempo médio correto', async () => {
      const agora = new Date().toISOString();
      const umaHoraAtras = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      
      metricsService.fetchJson = jest.fn().mockResolvedValue([
        { timestamp: umaHoraAtras, tempo_resposta: 100 },
        { timestamp: agora, tempo_resposta: 200 },
        { timestamp: agora, tempo_resposta: 300 },
        { timestamp: '2023-01-01T00:00:00.000Z', tempo_resposta: 400 } // fora do período
      ]);
      
      const resultado = await metricsService.tempoMedioRespostaUltimaHora();
      
      expect(resultado).toBe(200); // (100 + 200 + 300) / 3 = 200
    });
    
    it('deve retornar 0 se sem dados', async () => {
      metricsService.fetchJson = jest.fn().mockResolvedValue([]);
      
      const resultado = await metricsService.tempoMedioRespostaUltimaHora();
      
      expect(resultado).toBe(0);
    });
  });
  
  describe('statusIAS', () => {
    it('deve retornar status verde para provedores saudáveis', async () => {
      metricsService.fetchJson = jest.fn().mockResolvedValue([
        [{ nome: 'provedor1', status: 'ok' }],
        [{ nome: 'provedor2', saudavel: true }]
      ]);
      
      const resultado = await metricsService.statusIAS();
      
      expect(resultado).toEqual({
        geral: 'verde',
        provedores: {
          'provedor1': 'verde',
          'provedor2': 'verde'
        }
      });
    });
    
    it('deve retornar status amarelo para provedores lentos', async () => {
      metricsService.fetchJson = jest.fn().mockResolvedValue([
        [{ nome: 'provedor1', status: 'lento' }],
        [{ nome: 'provedor2', tempo_resposta: 6000 }]
      ]);
      
      const resultado = await metricsService.statusIAS();
      
      expect(resultado).toEqual({
        geral: 'amarelo',
        provedores: {
          'provedor1': 'amarelo',
          'provedor2': 'amarelo'
        }
      });
    });
    
    it('deve retornar status vermelho para provedores com falha', async () => {
      metricsService.fetchJson = jest.fn().mockResolvedValue([
        [{ nome: 'provedor1', status: 'falha' }],
        [{ nome: 'provedor2', degradado: true }]
      ]);
      
      const resultado = await metricsService.statusIAS();
      
      expect(resultado).toEqual({
        geral: 'vermelho',
        provedores: {
          'provedor1': 'vermelho',
          'provedor2': 'vermelho'
        }
      });
    });
  });
  
  describe('cotaUsadaPorProvedor', () => {
    it('deve calcular cota corretamente', async () => {
      metricsService.fetchJson = jest.fn().mockResolvedValue([
        { provedor: 'openai', usado: 100, limite: 1000 },
        { provedor: 'anthropic', used: 500, limit: 2000 }
      ]);
      
      const resultado = await metricsService.cotaUsadaPorProvedor();
      
      expect(resultado).toEqual({
        'openai': { usado: 100, limite: 1000, percentual: 10 },
        'anthropic': { usado: 500, limite: 2000, percentual: 25 }
      });
    });
    
    it('deve usar valores padrão quando limite for 0', async () => {
      metricsService.fetchJson = jest.fn().mockResolvedValue([
        { provedor: 'test', usado: 100, limite: 0 }
      ]);
      
      const resultado = await metricsService.cotaUsadaPorProvedor();
      
      expect(resultado).toEqual({
        'test': { usado: 100, limite: 0, percentual: 0 }
      });
    });
  });
  
  describe('mensagensPorMinuto', () => {
    it('deve contar mensagens corretamente', async () => {
      const agora = new Date().toISOString();
      const umMinutoAtras = new Date(Date.now() - 30 * 1000).toISOString();
      
      metricsService.fetchJson = jest.fn().mockResolvedValue([
        { timestamp: umMinutoAtras, tipo: 'mensagem' },
        { timestamp: agora, tipo: 'mensagem' },
        { timestamp: agora, tipo: 'mensagem' },
        { timestamp: '2023-01-01T00:00:00.000Z', tipo: 'mensagem' } // fora do período
      ]);
      
      const resultado = await metricsService.mensagensPorMinuto();
      
      expect(resultado).toBe(3);
    });
    
    it('deve retornar 0 se sem mensagens', async () => {
      metricsService.fetchJson = jest.fn().mockResolvedValue([]);
      
      const resultado = await metricsService.mensagensPorMinuto();
      
      expect(resultado).toBe(0);
    });
  });
  
  describe('tamanhoFila', () => {
    it('deve contar fila corretamente', async () => {
      metricsService.fetchJson = jest.fn().mockResolvedValue([
        { status: 'pendente' },
        { status: 'pendente' },
        { status: 'processando' },
        { status: 'concluido' }
      ]);
      
      const resultado = await metricsService.tamanhoFila();
      
      expect(resultado).toEqual({
        tamanho: 4,
        pendentes: 2,
        processando: 1
      });
    });
    
    it('deve lidar com diferentes formatos de status', async () => {
      metricsService.fetchJson = jest.fn().mockResolvedValue([
        { estado: 'aguardando' },
        { estado: 'em_andamento' },
        { status: 'waiting' },
        { status: 'processing' }
      ]);
      
      const resultado = await metricsService.tamanhoFila();
      
      expect(resultado).toEqual({
        tamanho: 4,
        pendentes: 2,
        processando: 2
      });
    });
  });
  
  describe('errosUltimaHora', () => {
    it('deve contar erros corretamente', async () => {
      const agora = new Date().toISOString();
      const umaHoraAtras = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      
      metricsService.fetchJson = jest.fn().mockResolvedValue([
        { timestamp: umaHoraAtras, nivel: 'error', mensagem: 'falha crítica' },
        { timestamp: agora, level: 'erro', message: 'erro de conexão' },
        { timestamp: agora, tipo: 'erro', mensagem: 'timeout' },
        { timestamp: agora, mensagem: 'algum erro aconteceu' },
        { timestamp: '2023-01-01T00:00:00.000Z', nivel: 'error' } // fora do período
      ]);
      
      const resultado = await metricsService.errosUltimaHora();
      
      expect(resultado).toBe(4);
    });
    
    it('deve retornar 0 se sem erros', async () => {
      metricsService.fetchJson = jest.fn().mockResolvedValue([
        { timestamp: new Date().toISOString(), nivel: 'info' }
      ]);
      
      const resultado = await metricsService.errosUltimaHora();
      
      expect(resultado).toBe(0);
    });
  });
  
  describe('resumo', () => {
    it('deve retornar resumo com todas as métricas', async () => {
      const agora = new Date().toISOString();
      
      metricsService.fetchJson = jest.fn().mockImplementation((path) => {
        if (path === '/api/cortex') return [{ timestamp: agora }];
        if (path === '/api/logs') return [{ timestamp: agora, tempo_resposta: 100 }];
        if (path === '/api/models') return [{ nome: 'test', status: 'ok' }];
        if (path === '/api/usage') return [{ provedor: 'test', usado: 100, limite: 1000 }];
        if (path === '/api/events') return [{ timestamp: agora }];
        if (path === '/api/pedidos') return [{ status: 'pendente' }];
        if (path === '/api/logs') return [{ timestamp: agora, nivel: 'error' }];
        return [];
      });
      
      const resultado = await metricsService.resumo();
      
      expect(resultado).toEqual({
        estadoCortex: {
          estado: 'online',
          ultimaAtualizacao: expect.any(String)
        },
        tempoMedioRespostaUltimaHoraMs: 100,
        statusIAS: expect.any(Object),
        cotaUsadaPorProvedor: expect.any(Object),
        mensagensPorMinuto: 1,
        fila: {
          tamanho: 1,
          pendentes: 1,
          processando: 0
        },
        errosUltimaHora: 1,
        geradoEm: expect.any(String)
      });
    });
  });
});
