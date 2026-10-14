const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert');
const { executar, escolherProximoCliente, gerarPost, publicarNoCanal, carregarEstado, salvarEstado } = require('./robo.js');
const fs = require('fs');
const path = require('path');

const ESTADO_PATH = path.join(__dirname, 'estado.json');
const ESTADO_ORIGINAL = fs.readFileSync(ESTADO_PATH, 'utf-8');

function resetarEstado() {
  fs.writeFileSync(ESTADO_PATH, ESTADO_ORIGINAL, 'utf-8');
}

describe('Robô de Divulgação', () => {
  beforeEach(() => {
    resetarEstado();
    // Configura variáveis de ambiente para tokens dos canais
    process.env.TWITTER_TOKEN = 'token_twitter';
    process.env.LINKEDIN_TOKEN = 'token_linkedin';
    process.env.FACEBOOK_TOKEN = 'token_facebook';
  });

  afterEach(() => {
    resetarEstado();
    // Limpa variáveis de ambiente
    delete process.env.TWITTER_TOKEN;
    delete process.env.LINKEDIN_TOKEN;
    delete process.env.FACEBOOK_TOKEN;
  });

  describe('Rodízio de clientes', () => {
    test('deve escolher o primeiro cliente no índice 0', () => {
      const estado = carregarEstado();
      const cliente = escolherProximoCliente(estado);
      assert.strictEqual(cliente.id, 'cli_001');
      assert.strictEqual(cliente.nome, 'Cliente Teste 1');
    });

    test('deve avançar para o segundo cliente na próxima chamada', () => {
      const estado = carregarEstado();
      escolherProximoCliente(estado); // primeiro
      const cliente = escolherProximoCliente(estado); // segundo
      assert.strictEqual(cliente.id, 'cli_002');
      assert.strictEqual(cliente.nome, 'Cliente Teste 2');
    });

    test('deve voltar ao primeiro cliente após o último (rodízio circular)', () => {
      const estado = carregarEstado();
      escolherProximoCliente(estado); // cli_001
      escolherProximoCliente(estado); // cli_002
      const cliente = escolherProximoCliente(estado); // volta para cli_001
      assert.strictEqual(cliente.id, 'cli_001');
    });

    test('deve persistir o índice do rodízio no estado', () => {
      const estado = carregarEstado();
      escolherProximoCliente(estado);
      salvarEstado(estado);
      
      const estadoRecarregado = carregarEstado();
      assert.strictEqual(estadoRecarregado.rodizioIndex, 1);
    });
  });

  describe('Geração de post com UTM', () => {
    test('deve gerar link com parâmetros UTM corretos', () => {
      const cliente = {
        id: 'cli_001',
        nome: 'Cliente Teste 1',
        utm_source: 'divulga',
        utm_medium: 'social',
        utm_campaign: 'cliente_teste_1'
      };
      
      const texto = gerarPost(cliente);
      
      assert.ok(texto.includes('https://exemplo.com/oferta?'));
      assert.ok(texto.includes('utm_source=divulga'));
      assert.ok(texto.includes('utm_medium=social'));
      assert.ok(texto.includes('utm_campaign=cliente_teste_1'));
      assert.ok(texto.includes('Cliente Teste 1'));
    });

    test('deve codificar corretamente caracteres especiais nos parâmetros UTM', () => {
      const cliente = {
        id: 'cli_003',
        nome: 'Cliente & Teste',
        utm_source: 'divulga',
        utm_medium: 'social',
        utm_campaign: 'campanha com espaços'
      };
      
      const texto = gerarPost(cliente);
      
      assert.ok(texto.includes('utm_campaign=campanha+com+espa%C3%A7os'));
    });
  });

  describe('Publicação em canais', () => {
    test('deve retornar sucesso quando a publicação funciona', async () => {
      const canal = {
        id: 'canal_001',
        nome: 'Twitter',
        ativo: true,
        endpoint: 'https://api.twitter.com/2/tweets',
        tokenEnv: 'TWITTER_TOKEN'
      };

      const fetchMock = mock.method(global, 'fetch', async () => ({
        ok: true,
        status: 200,
        text: async () => 'OK'
      }));

      const resultado = await publicarNoCanal(canal, 'Texto de teste');
      
      assert.strictEqual(resultado.sucesso, true);
      assert.strictEqual(resultado.canal, 'Twitter');
      fetchMock.mock.restore();
    });

    test('deve retornar erro quando a publicação falha', async () => {
      const canal = {
        id: 'canal_001',
        nome: 'Twitter',
        ativo: true,
        endpoint: 'https://api.twitter.com/2/tweets',
        tokenEnv: 'TWITTER_TOKEN'
      };

      const fetchMock = mock.method(global, 'fetch', async () => ({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized'
      }));

      const resultado = await publicarNoCanal(canal, 'Texto de teste');
      
      assert.strictEqual(resultado.sucesso, false);
      assert.strictEqual(resultado.canal, 'Twitter');
      assert.ok(resultado.erro.includes('401'));
      fetchMock.mock.restore();
    });

    test('deve retornar erro quando fetch lança exceção', async () => {
      const canal = {
        id: 'canal_001',
        nome: 'Twitter',
        ativo: true,
        endpoint: 'https://api.twitter.com/2/tweets',
        tokenEnv: 'TWITTER_TOKEN'
      };

      const fetchMock = mock.method(global, 'fetch', async () => {
        throw new Error('Network error');
      });

      const resultado = await publicarNoCanal(canal, 'Texto de teste');
      
      assert.strictEqual(resultado.sucesso, false);
      assert.strictEqual(resultado.canal, 'Twitter');
      assert.ok(resultado.erro.includes('Erro de rede'));
      fetchMock.mock.restore();
    });

    test('deve retornar erro de configuração quando tokenEnv ausente', async () => {
      const canal = {
        id: 'canal_001',
        nome: 'Twitter',
        ativo: true,
        endpoint: 'https://api.twitter.com/2/tweets'
        // tokenEnv ausente
      };

      const resultado = await publicarNoCanal(canal, 'Texto de teste');
      
      assert.strictEqual(resultado.sucesso, false);
      assert.strictEqual(resultado.canal, 'Twitter');
      assert.ok(resultado.erro.includes('Configuração inválida'));
      assert.ok(resultado.erro.includes('tokenEnv ausente'));
    });

    test('deve retornar erro de configuração quando variável de ambiente não definida', async () => {
      const canal = {
        id: 'canal_001',
        nome: 'Twitter',
        ativo: true,
        endpoint: 'https://api.twitter.com/2/tweets',
        tokenEnv: 'TOKEN_INEXISTENTE'
      };

      const resultado = await publicarNoCanal(canal, 'Texto de teste');
      
      assert.strictEqual(resultado.sucesso, false);
      assert.strictEqual(resultado.canal, 'Twitter');
      assert.ok(resultado.erro.includes('Configuração inválida'));
      assert.ok(resultado.erro.includes('TOKEN_INEXISTENTE'));
    });
  });

  describe('Execução completa', () => {
    test('modo ensaio quando não há canais ativos', async () => {
      // Modifica estado para não ter canais ativos
      const estado = carregarEstado();
      estado.canais = estado.canais.map(c => ({ ...c, ativo: false }));
      salvarEstado(estado);

      const consoleLogMock = mock.method(console, 'log');
      
      const resultado = await executar();
      
      assert.strictEqual(resultado.sucesso, true);
      assert.strictEqual(resultado.modo, 'ensaio');
      assert.ok(resultado.texto.includes('utm_source=divulga'));
      consoleLogMock.mock.restore();
    });

    test('deve publicar em todos os canais ativos e continuar mesmo se um falhar', async () => {
      const estado = carregarEstado();
      // Garante que há canais ativos
      estado.canais = estado.canais.map(c => ({ ...c, ativo: true }));
      salvarEstado(estado);

      let callCount = 0;
      const fetchMock = mock.method(global, 'fetch', async () => {
        callCount++;
        if (callCount === 2) {
          // Segundo canal falha
          return { ok: false, status: 500, text: async () => 'Server Error' };
        }
        return { ok: true, status: 200, text: async () => 'OK' };
      });

      const resultado = await executar();
      
      assert.strictEqual(resultado.sucesso, true);
      assert.strictEqual(resultado.resultados.length, 3); // 3 canais ativos
      
      const sucessos = resultado.resultados.filter(r => r.sucesso);
      const falhas = resultado.resultados.filter(r => !r.sucesso);
      
      assert.strictEqual(sucessos.length, 2);
      assert.strictEqual(falhas.length, 1);
      assert.strictEqual(falhas[0].canal, 'LinkedIn'); // segundo canal
      fetchMock.mock.restore();
    });

    test('deve avançar rodízio a cada execução', async () => {
      const estado = carregarEstado();
      estado.canais = estado.canais.map(c => ({ ...c, ativo: false })); // modo ensaio
      salvarEstado(estado);

      await executar(); // primeira execução -> cli_001
      const resultado2 = await executar(); // segunda execução -> cli_002
      
      assert.strictEqual(resultado2.cliente, 'Cliente Teste 2');
    });
  });

  describe('Estado vazio', () => {
    test('deve retornar erro quando não há clientes', async () => {
      const estado = carregarEstado();
      estado.clientes = [];
      salvarEstado(estado);

      const resultado = await executar();
      
      assert.strictEqual(resultado.sucesso, false);
      assert.strictEqual(resultado.motivo, 'sem_clientes');
    });
  });
});