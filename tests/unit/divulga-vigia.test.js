'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { vigiarDivulga, exibeExplicacaoErro, sanitizeError } = require('../../divulga/vigia');

test('DIVULGA-VIGIA: exibeExplicacaoErro mapeia códigos e mensagens de erro corretamente', () => {
  assert.strictEqual(exibeExplicacaoErro('Error 190: Invalid OAuth access token'), 'rode de novo o configurar-meta.bat');
  assert.strictEqual(exibeExplicacaoErro('Error 17: User rate limit reached'), 'espera sozinho');
  assert.strictEqual(exibeExplicacaoErro('Error 32: Page request limit reached'), 'espera sozinho');
  assert.strictEqual(exibeExplicacaoErro('Error 4: Application rate limit reached'), 'espera sozinho');
  assert.strictEqual(exibeExplicacaoErro('A imagem fornecida está com dimensão e aspecto fora do padrão'), 'imagem fora do padrão');
});

test('DIVULGA-VIGIA: detecta 2 falhas seguidas na mesma rede e abre issue com o rótulo cortex-alerta e corpo sanitizado', async () => {
  const agora = new Date('2026-10-20T12:00:00Z').getTime();
  const estadoFake = {
    historico: [
      {
        quando: new Date(agora - 3 * 3600 * 1000).toISOString(),
        id: 'post1',
        cliente: 'body-coach',
        resultados: [{ canal: 'instagram', ok: false, erro: 'Error 190: token expired access_token=secret123' }],
      },
      {
        quando: new Date(agora - 1 * 3600 * 1000).toISOString(),
        id: 'post2',
        cliente: 'body-coach',
        resultados: [{ canal: 'instagram', ok: false, erro: 'Error 190: token expired access_token=secret123' }],
      },
    ],
  };

  const chamadasGh = [];
  const fetchFake = async (url, options = {}) => {
    chamadasGh.push({ url, method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : null });

    if (url.endsWith('/contents/divulga-estado.json?ref=divulga-dados')) {
      const b64 = Buffer.from(JSON.stringify(estadoFake)).toString('base64');
      return { ok: true, json: async () => ({ content: b64 }) };
    }
    if (url.includes('/issues?state=open&labels=cortex-alerta')) {
      return { ok: true, json: async () => [] };
    }
    if (url.endsWith('/issues')) {
      return { ok: true, json: async () => ({ number: 101 }) };
    }
    return { ok: true, json: async () => ({}) };
  };

  await vigiarDivulga({
    env: { GITHUB_TOKEN: 'fake-token', GITHUB_REPOSITORY: 'gilcambe/nexia' },
    fetchImpl: fetchFake,
    agora,
  });

  const criacaoIssue = chamadasGh.find((c) => c.method === 'POST' && c.url.endsWith('/issues'));
  assert.ok(criacaoIssue, 'Deve ter aberto uma issue para o alerta');
  assert.strictEqual(criacaoIssue.body.title, 'Divulga parado: instagram');
  assert.deepStrictEqual(criacaoIssue.body.labels, ['cortex-alerta']);
  assert.ok(criacaoIssue.body.body.includes('rode de novo o configurar-meta.bat'));
  assert.ok(!criacaoIssue.body.body.includes('secret123'), 'Erro deve estar sanitizado');
});

test('DIVULGA-VIGIA: fecha issue aberta quando a rede volta a postar com sucesso', async () => {
  const agora = new Date('2026-10-20T12:00:00Z').getTime();
  const estadoFake = {
    historico: [
      {
        quando: new Date(agora - 1 * 3600 * 1000).toISOString(),
        id: 'post1',
        cliente: 'body-coach',
        resultados: [{ canal: 'facebook', ok: true }],
      },
    ],
  };

  const issuesAbertasFake = [
    { number: 42, title: 'Divulga parado: facebook', state: 'open' },
  ];

  const chamadasGh = [];
  const fetchFake = async (url, options = {}) => {
    chamadasGh.push({ url, method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : null });

    if (url.endsWith('/contents/divulga-estado.json?ref=divulga-dados')) {
      const b64 = Buffer.from(JSON.stringify(estadoFake)).toString('base64');
      return { ok: true, json: async () => ({ content: b64 }) };
    }
    if (url.includes('/issues?state=open&labels=cortex-alerta')) {
      return { ok: true, json: async () => issuesAbertasFake };
    }
    return { ok: true, json: async () => ({}) };
  };

  await vigiarDivulga({
    env: { GITHUB_TOKEN: 'fake-token', GITHUB_REPOSITORY: 'gilcambe/nexia' },
    fetchImpl: fetchFake,
    agora,
  });

  const fechamentoIssue = chamadasGh.find((c) => c.method === 'PATCH' && c.url.endsWith('/issues/42'));
  assert.ok(fechamentoIssue, 'Deve ter fechado a issue #42');
  assert.strictEqual(fechamentoIssue.body.state, 'closed');
});
