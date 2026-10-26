// Testes unitários do src/services/metricsService.js
// Rode com: npm test  (node --test)

// Simula ambiente de navegador (window.location.origin) antes de importar o serviço.
globalThis.window = { location: { origin: 'http://localhost:3000' } };

const { test } = require('node:test');
const assert = require('node:assert/strict');

// Mock de fetch controlado por endpoint.
const dadosPorEndpoint = {};

globalThis.fetch = async (url) => {
  const caminho = typeof url === 'string' ? new URL(url).pathname : (url.url ? new URL(url.url).pathname : '');
  if (!(caminho in dadosPorEndpoint)) {
    return new Response(JSON.stringify(null), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response(JSON.stringify(dadosPorEndpoint[caminho]), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

const metricsService = require('../../src/services/metricsService.js');

function resetarDados() {
  Object.keys(dadosPorEndpoint).forEach((k) => delete dadosPorEndpoint[k]);
}

test('estadoCortex retorna objeto com strings (estado e ultimaAtualizacao)', async (t) => {
  resetarDados();
  dadosPorEndpoint['/api/cortex'] = [
    { timestamp: new Date().toISOString(), status: 'ok' },
  ];

  const resultado = await metricsService.estadoCortex();

  assert.ok(resultado, 'deve retornar objeto');
  assert.strictEqual(typeof resultado.estado, 'string', 'estado deve ser string');
  assert.strictEqual(typeof resultado.ultimaAtualizacao, 'string', 'ultimaAtualizacao deve ser string');
  assert.ok(['online', 'degradado', 'offline'].includes(resultado.estado), 'estado deve ser um dos valores esperados');
});

test('estadoCortex fallback retorna strings quando fonte indisponível', async (t) => {
  resetarDados();
  // Nenhum endpoint mockado → fetch retorna 404 → fallback

  const resultado = await metricsService.estadoCortex();

  assert.strictEqual(typeof resultado.estado, 'string');
  assert.strictEqual(typeof resultado.ultimaAtualizacao, 'string');
});

test('tempoMedioRespostaUltimaHora retorna número', async (t) => {
  resetarDados();
  const agora = new Date().toISOString();
  dadosPorEndpoint['/api/logs'] = [
    { timestamp: agora, tempo_resposta: 120 },
    { timestamp: agora, tempo_resposta: 280 },
    { timestamp: agora, tempo_resposta: 200 },
  ];

  const resultado = await metricsService.tempoMedioRespostaUltimaHora();

  assert.strictEqual(typeof resultado, 'number', 'deve retornar número');
  assert.ok(Number.isFinite(resultado), 'deve ser número finito');
  assert.ok(resultado >= 0, 'deve ser não negativo');
});

test('tempoMedioRespostaUltimaHora retorna 0 quando não há dados', async (t) => {
  resetarDados();
  dadosPorEndpoint['/api/logs'] = [];

  const resultado = await metricsService.tempoMedioRespostaUltimaHora();

  assert.strictEqual(resultado, 0);
  assert.strictEqual(typeof resultado, 'number');
});

test('statusIAS retorna objeto com geral (string) e provedores (objeto)', async (t) => {
  resetarDados();
  dadosPorEndpoint['/api/models'] = [
    { nome: 'provedor-a', status: 'ok' },
    { nome: 'provedor-b', status: 'lento' },
    { nome: 'provedor-c', status: 'erro' },
  ];

  const resultado = await metricsService.statusIAS();

  assert.ok(resultado, 'deve retornar objeto');
  assert.strictEqual(typeof resultado.geral, 'string', 'geral deve ser string');
  assert.ok(['verde', 'amarelo', 'vermelho'].includes(resultado.geral), 'geral deve ser verde/amarelo/vermelho');
  assert.strictEqual(typeof resultado.provedores, 'object', 'provedores deve ser objeto');
  assert.notStrictEqual(resultado.provedores, null, 'provedores não deve ser null');
});

test('statusIAS fallback retorna vermelho quando não há provedores', async (t) => {
  resetarDados();
  dadosPorEndpoint['/api/models'] = [];
  dadosPorEndpoint['/api/agents'] = [];
  dadosPorEndpoint['/api/ia-status'] = [];

  const resultado = await metricsService.statusIAS();

  assert.strictEqual(resultado.geral, 'vermelho');
  assert.strictEqual(typeof resultado.geral, 'string');
  assert.strictEqual(typeof resultado.provedores, 'object');
});

test('cotaUsadaPorProvedor retorna objeto com uso por provedor', async (t) => {
  resetarDados();
  dadosPorEndpoint['/api/usage'] = [
    { provedor: 'anthropic', usado: 1200, limite: 5000 },
    { provedor: 'groq', usado: 800, limite: 2000 },
  ];

  const resultado = await metricsService.cotaUsadaPorProvedor();

  assert.strictEqual(typeof resultado, 'object', 'deve retornar objeto');
  assert.notStrictEqual(resultado, null);
  const chaves = Object.keys(resultado);
  assert.ok(chaves.length > 0, 'deve conter pelo menos um provedor');
  for (const chave of chaves) {
    const item = resultado[chave];
    assert.strictEqual(typeof item.usado, 'number', `usado de ${chave} deve ser número`);
    assert.strictEqual(typeof item.limite, 'number', `limite de ${chave} deve ser número`);
    assert.strictEqual(typeof item.percentual, 'number', `percentual de ${chave} deve ser número`);
  }
});

test('cotaUsadaPorProvedor retorna objeto vazio quando não há dados', async (t) => {
  resetarDados();
  dadosPorEndpoint['/api/usage'] = [];

  const resultado = await metricsService.cotaUsadaPorProvedor();

  assert.strictEqual(typeof resultado, 'object');
  assert.strictEqual(Object.keys(resultado).length, 0);
});

test('mensagensPorMinuto retorna número', async (t) => {
  resetarDados();
  const agora = new Date().toISOString();
  dadosPorEndpoint['/api/events'] = [
    { timestamp: agora, tipo: 'mensagem' },
    { timestamp: agora, tipo: 'mensagem' },
    { timestamp: agora, tipo: 'mensagem' },
  ];

  const resultado = await metricsService.mensagensPorMinuto();

  assert.strictEqual(typeof resultado, 'number', 'deve retornar número');
  assert.ok(Number.isInteger(resultado), 'deve ser inteiro');
  assert.ok(resultado >= 0, 'deve ser não negativo');
});

test('mensagensPorMinuto retorna 0 quando não há eventos recentes', async (t) => {
  resetarDados();
  const haDuasHoras = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  dadosPorEndpoint['/api/events'] = [
    { timestamp: haDuasHoras, tipo: 'mensagem' },
  ];

  const resultado = await metricsService.mensagensPorMinuto();

  assert.strictEqual(resultado, 0);
  assert.strictEqual(typeof resultado, 'number');
});

test('tamanhoFila retorna objeto com números (tamanho, pendentes, processando)', async (t) => {
  resetarDados();
  dadosPorEndpoint['/api/pedidos'] = [
    { status: 'pendente' },
    { status: 'pendente' },
    { status: 'processando' },
    { status: 'concluido' },
  ];

  const resultado = await metricsService.tamanhoFila();

  assert.ok(resultado, 'deve retornar objeto');
  assert.strictEqual(typeof resultado.tamanho, 'number', 'tamanho deve ser número');
  assert.strictEqual(typeof resultado.pendentes, 'number', 'pendentes deve ser número');
  assert.strictEqual(typeof resultado.processando, 'number', 'processando deve ser número');
  assert.strictEqual(resultado.tamanho, 4);
  assert.strictEqual(resultado.pendentes, 2);
  assert.strictEqual(resultado.processando, 1);
});

test('tamanhoFila retorna zeros quando não há dados', async (t) => {
  resetarDados();
  dadosPorEndpoint['/api/pedidos'] = [];

  const resultado = await metricsService.tamanhoFila();

  assert.strictEqual(resultado.tamanho, 0);
  assert.strictEqual(resultado.pendentes, 0);
  assert.strictEqual(resultado.processando, 0);
  assert.strictEqual(typeof resultado.tamanho, 'number');
});

test('errosUltimaHora retorna número', async (t) => {
  resetarDados();
  const agora = new Date().toISOString();
  dadosPorEndpoint['/api/logs'] = [
    { timestamp: agora, nivel: 'erro', mensagem: 'falha de rede' },
    { timestamp: agora, nivel: 'info', mensagem: 'ok' },
    { timestamp: agora, nivel: 'error', mensagem: 'exception' },
  ];

  const resultado = await metricsService.errosUltimaHora();

  assert.strictEqual(typeof resultado, 'number', 'deve retornar número');
  assert.ok(Number.isInteger(resultado), 'deve ser inteiro');
  assert.ok(resultado >= 0, 'deve ser não negativo');
});

test('errosUltimaHora retorna 0 quando não há erros na última hora', async (t) => {
  resetarDados();
  const haDuasHoras = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  dadosPorEndpoint['/api/logs'] = [
    { timestamp: haDuasHoras, nivel: 'erro', mensagem: 'falha antiga' },
  ];

  const resultado = await metricsService.errosUltimaHora();

  assert.strictEqual(resultado, 0);
  assert.strictEqual(typeof resultado, 'number');
});

test('resumo retorna objeto com todas as métricas', async (t) => {
  resetarDados();
  const agora = new Date().toISOString();
  dadosPorEndpoint['/api/cortex'] = [{ timestamp: agora, status: 'ok' }];
  dadosPorEndpoint['/api/logs'] = [
    { timestamp: agora, tempo_resposta: 100, nivel: 'info' },
    { timestamp: agora, tempo_resposta: 200, nivel: 'erro' },
  ];
  dadosPorEndpoint['/api/models'] = [{ nome: 'ia-x', status: 'ok' }];
  dadosPorEndpoint['/api/usage'] = [{ provedor: 'ia-x', usado: 100, limite: 1000 }];
  dadosPorEndpoint['/api/events'] = [{ timestamp: agora, tipo: 'mensagem' }];
  dadosPorEndpoint['/api/pedidos'] = [{ status: 'pendente' }];

  const resultado = await metricsService.resumo();

  assert.ok(resultado, 'deve retornar objeto');
  assert.strictEqual(typeof resultado.estadoCortex, 'object');
  assert.strictEqual(typeof resultado.tempoMedioRespostaUltimaHoraMs, 'number');
  assert.strictEqual(typeof resultado.statusIAS, 'object');
  assert.strictEqual(typeof resultado.cotaUsadaPorProvedor, 'object');
  assert.strictEqual(typeof resultado.mensagensPorMinuto, 'number');
  assert.strictEqual(typeof resultado.fila, 'object');
  assert.strictEqual(typeof resultado.errosUltimaHora, 'number');
  assert.strictEqual(typeof resultado.geradoEm, 'string');
});

test('todas as funções retornam valores seguros quando a fonte cai', async (t) => {
  resetarDados();
  // Sem nenhum endpoint mockado → fetch retorna 404 para todos

  const estado = await metricsService.estadoCortex();
  assert.strictEqual(typeof estado.estado, 'string');
  assert.strictEqual(typeof estado.ultimaAtualizacao, 'string');

  const tempo = await metricsService.tempoMedioRespostaUltimaHora();
  assert.strictEqual(typeof tempo, 'number');

  const statusIA = await metricsService.statusIAS();
  assert.strictEqual(typeof statusIA.geral, 'string');
  assert.strictEqual(typeof statusIA.provedores, 'object');

  const cota = await metricsService.cotaUsadaPorProvedor();
  assert.strictEqual(typeof cota, 'object');

  const msgs = await metricsService.mensagensPorMinuto();
  assert.strictEqual(typeof msgs, 'number');

  const fila = await metricsService.tamanhoFila();
  assert.strictEqual(typeof fila.tamanho, 'number');

  const erros = await metricsService.errosUltimaHora();
  assert.strictEqual(typeof erros, 'number');
});
