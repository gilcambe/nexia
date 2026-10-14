const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { executar, escolherProximoCliente, gerarPost, lerEstado, escreverEstado } = require('./robo.js');

const ESTADO_PATH = path.join(__dirname, 'estado.json');
const CANAIS_PATH = path.join(__dirname, 'canais.json');
const CLIENTES_PATH = path.join(__dirname, 'clientes.json');

const ESTADO_ORIGINAL = {
  indiceCliente: 0,
  historico: []
};

const CANAIS_TESTE = [
  { id: '1', nome: 'Canal A', ativo: true },
  { id: '2', nome: 'Canal B', ativo: true },
  { id: '3', nome: 'Canal C', ativo: false }
];

const CLIENTES_TESTE = [
  { id: 'cli-1', nome: 'Cliente Um' },
  { id: 'cli-2', nome: 'Cliente Dois' },
  { id: 'cli-3', nome: 'Cliente Tres' }
];

function setupTestFiles() {
  fs.writeFileSync(ESTADO_PATH, JSON.stringify(ESTADO_ORIGINAL, null, 2));
  fs.writeFileSync(CANAIS_PATH, JSON.stringify(CANAIS_TESTE, null, 2));
  fs.writeFileSync(CLIENTES_PATH, JSON.stringify(CLIENTES_TESTE, null, 2));
}

function cleanupTestFiles() {
  [ESTADO_PATH, CANAIS_PATH, CLIENTES_PATH].forEach(p => {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  });
}

describe('Robô de Divulgação', () => {
  beforeEach(() => {
    setupTestFiles();
  });

  afterEach(() => {
    cleanupTestFiles();
  });

  describe('Rodízio de clientes', () => {
    test('deve escolher clientes em ordem cíclica', () => {
      const estado = lerEstado();
      const clientes = lerClientes();
      
      const c1 = escolherProximoCliente(clientes, estado);
      assert.strictEqual(c1.id, 'cli-1');
      
      const c2 = escolherProximoCliente(clientes, estado);
      assert.strictEqual(c2.id, 'cli-2');
      
      const c3 = escolherProximoCliente(clientes, estado);
      assert.strictEqual(c3.id, 'cli-3');
      
      const c4 = escolherProximoCliente(clientes, estado);
      assert.strictEqual(c4.id, 'cli-1'); // volta ao início
    });

    test('deve persistir índice no estado', () => {
      const estado = lerEstado();
      const clientes = lerClientes();
      
      escolherProximoCliente(clientes, estado);
      escolherProximoCliente(clientes, estado);
      escreverEstado(estado);
      
      const novoEstado = lerEstado();
      assert.strictEqual(novoEstado.indiceCliente, 2);
    });
  });

  describe('Geração de post com UTM', () => {
    test('deve gerar link com parâmetros UTM corretos', () => {
      const cliente = { id: 'cli-123', nome: 'Meu Cliente' };
      const post = gerarPost(cliente);
      
      assert.ok(post.link.includes('utm_source=divulga'));
      assert.ok(post.link.includes('utm_medium=robo'));
      assert.ok(post.link.includes('utm_campaign=cli-123'));
      assert.ok(post.texto.includes('Meu Cliente'));
      assert.ok(post.texto.includes(post.link));
    });
  });

  describe('Execução com canais ativos', () => {
    test('deve publicar em todos os canais ativos e registrar resultados', async () => {
      const resultado = await executar();
      
      assert.strictEqual(resultado.modo, 'producao');
      assert.strictEqual(resultado.cliente, 'Cliente Um');
      assert.ok(Array.isArray(resultado.resultados));
      assert.strictEqual(resultado.resultados.length, 2); // apenas 2 canais ativos
      
      resultado.resultados.forEach(r => {
        assert.strictEqual(r.sucesso, true);
        assert.ok(r.canal);
        assert.ok(r.postId);
      });
    });

    test('canal com erro não derruba os outros', async () => {
      // Adiciona canal com erro simulado
      const canaisComErro = [
        ...CANAIS_TESTE,
        { id: '4', nome: 'Canal Com Erro', ativo: true, simularErro: true }
      ];
      fs.writeFileSync(CANAIS_PATH, JSON.stringify(canaisComErro, null, 2));
      
      const resultado = await executar();
      
      assert.strictEqual(resultado.resultados.length, 3);
      const comErro = resultado.resultados.find(r => r.canal === 'Canal Com Erro');
      assert.strictEqual(comErro.sucesso, false);
      assert.ok(comErro.erro);
      
      const sucessos = resultado.resultados.filter(r => r.sucesso);
      assert.strictEqual(sucessos.length, 2);
    });
  });

  describe('Modo ensaio (sem canais ativos)', () => {
    test('deve imprimir apenas o texto quando não há canais ativos', async () => {
      fs.writeFileSync(CANAIS_PATH, JSON.stringify([
        { id: '1', nome: 'Canal Inativo', ativo: false }
      ], null, 2));
      
      const resultado = await executar();
      
      assert.strictEqual(resultado.modo, 'ensaios');
      assert.ok(resultado.post.includes('Cliente Um'));
      assert.ok(resultado.post.includes('utm_source=divulga'));
    });
  });
});
