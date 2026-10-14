const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { executar, lerEstado, salvarEstado, proximoCliente, gerarPost } = require('./robo.js');

const ESTADO_PATH = path.join(__dirname, 'estado.json');
const ESTADO_ORIGINAL = fs.readFileSync(ESTADO_PATH, 'utf-8');

function resetEstado() {
  fs.writeFileSync(ESTADO_PATH, ESTADO_ORIGINAL, 'utf-8');
}

beforeEach(() => resetEstado());
afterEach(() => resetEstado());

describe('rodízio de clientes', () => {
  test('seleciona o próximo cliente com canal ativo', () => {
    const estado = lerEstado();
    const c1 = proximoCliente(estado);
    assert.strictEqual(c1.id, 'cli_1');
    assert.strictEqual(estado.indice_atual, 1);
  });

  test('avança para o segundo cliente', () => {
    const estado = lerEstado();
    proximoCliente(estado);
    const c2 = proximoCliente(estado);
    assert.strictEqual(c2.id, 'cli_2');
  });

  test('volta para o primeiro após o último', () => {
    const estado = lerEstado();
    proximoCliente(estado);
    proximoCliente(estado);
    const c3 = proximoCliente(estado);
    assert.strictEqual(c3.id, 'cli_1');
  });

  test('ignora clientes sem canal ativo', () => {
    const estado = lerEstado();
    estado.clientes[0].canais.forEach(c => c.ativo = false);
    const c = proximoCliente(estado);
    assert.strictEqual(c.id, 'cli_2');
  });

  test('retorna null quando nenhum cliente tem canal ativo', () => {
    const estado = lerEstado();
    estado.clientes.forEach(cli => cli.canais.forEach(c => c.ativo = false));
    const c = proximoCliente(estado);
    assert.strictEqual(c, null);
  });
});

describe('gerarPost', () => {
  test('inclui utm_source do cliente', () => {
    const cliente = { nome: 'Teste', utm_source: 'meu-cliente' };
    const post = gerarPost(cliente);
    assert.ok(post.includes('utm_source=meu-cliente'));
  });

  test('inclui utm_medium=bot', () => {
    const cliente = { nome: 'Teste', utm_source: 'x' };
    const post = gerarPost(cliente);
    assert.ok(post.includes('utm_medium=bot'));
  });

  test('inclui utm_campaign=divulga', () => {
    const cliente = { nome: 'Teste', utm_source: 'x' };
    const post = gerarPost(cliente);
    assert.ok(post.includes('utm_campaign=divulga'));
  });

  test('contém o nome do cliente', () => {
    const cliente = { nome: 'Cliente Especial', utm_source: 'x' };
    const post = gerarPost(cliente);
    assert.ok(post.includes('Cliente Especial'));
  });
});

describe('executar com fetch mockado', () => {
  let fetchOriginal;

  beforeEach(() => {
    fetchOriginal = global.fetch;
    global.fetch = mock.fn(async (url, opts) => {
      if (url.includes('telegram.org')) {
        return { ok: true, status: 200, text: async () => '{"ok":true}' };
      }
      if (url.includes('graph.facebook.com')) {
        return { ok: true, status: 200, text: async () => '{"messages":[{"id":"msg_1"}]}' };
      }
      return { ok: false, status: 404, text: async () => 'Not Found' };
    });
  });

  afterEach(() => {
    global.fetch = fetchOriginal;
  });

  test('publica em todos os canais ativos do cliente', async () => {
    const resultado = await executar();
    assert.strictEqual(resultado.modo, 'producao');
    assert.strictEqual(resultado.cliente, 'cli_1');
    assert.strictEqual(resultado.resultados.length, 2);
    assert.ok(resultado.resultados.every(r => r.ok === true));
  });

  test('canal com erro não derruba os outros', async () => {
    global.fetch = mock.fn(async (url, opts) => {
      if (url.includes('telegram.org')) {
        return { ok: false, status: 500, text: async () => 'Internal Error' };
      }
      if (url.includes('graph.facebook.com')) {
        return { ok: true, status: 200, text: async () => '{"messages":[{"id":"msg_1"}]}' };
      }
      return { ok: false, status: 404, text: async () => 'Not Found' };
    });

    const resultado = await executar();
    assert.strictEqual(resultado.resultados.length, 2);
    const telegram = resultado.resultados.find(r => r.canal === 'canal_1');
    const whatsapp = resultado.resultados.find(r => r.canal === 'canal_2');
    assert.strictEqual(telegram.ok, false);
    assert.strictEqual(whatsapp.ok, true);
  });

  test('modo ensaio quando cliente sem canal ativo', async () => {
    const estado = lerEstado();
    estado.clientes[0].canais.forEach(c => c.ativo = false);
    estado.clientes[1].canais.forEach(c => c.ativo = false);
    salvarEstado(estado);

    const logs = [];
    const logOriginal = console.log;
    console.log = (...args) => logs.push(args.join(' '));

    const resultado = await executar();
    console.log = logOriginal;

    assert.strictEqual(resultado.modo, 'ensaio');
    assert.ok(logs.some(l => l.includes('MODO ENSAIO')));
    assert.ok(logs.some(l => l.includes('utm_source=')));
  });
});
