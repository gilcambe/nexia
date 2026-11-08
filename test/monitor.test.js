'use strict';
const test = require('node:test');
const assert = require('node:assert');
const {
  verificarEndpoints,
  monitorarPrumo,
  contarFalhasEmComentarios,
  TITULO_ALERTA,
  ROTULO_ALERTA,
} = require('../.github/scripts/prumo-monitor');

function mockFetch(rotas) {
  return async function fetchImpl(url, init = {}) {
    const method = init.method || 'GET';
    const chave = `${method} ${url}`;
    const rota = rotas[chave] || rotas[url];
    if (!rota) {
      return {
        ok: false,
        status: 404,
        json: async () => ({ message: 'Not found' }),
      };
    }
    if (rota.erro) {
      throw new Error(rota.erro);
    }
    return {
      ok: rota.status >= 200 && rota.status < 300,
      status: rota.status ?? 200,
      json: async () => (typeof rota.json === 'function' ? rota.json() : (rota.json || {})),
    };
  };
}

test('PRUMO-MON1: endpoints saudáveis (/prumo/ 200 e /api/prumo 200 ou 405)', async () => {
  const fetchImpl = mockFetch({
    'https://nexia.gcbezerra.workers.dev/prumo/': { status: 200 },
    'https://nexia.gcbezerra.workers.dev/api/prumo': { status: 405 },
  });

  const res = await verificarEndpoints({ fetchImpl });
  assert.strictEqual(res.saudavel, true);
  assert.strictEqual(res.detalhes.app.ok, true);
  assert.strictEqual(res.detalhes.api.ok, true);
});

test('PRUMO-MON2: monitorarPrumo retorna saudavel=true e não cria issue quando endpoints respondem normalmente', async () => {
  let chamouCriacao = false;
  const rotas = {
    'https://nexia.gcbezerra.workers.dev/prumo/': { status: 200 },
    'https://nexia.gcbezerra.workers.dev/api/prumo': { status: 200 },
    'GET https://api.github.com/repos/gilcambe/nexia/issues?state=open&labels=cortex-alerta&per_page=50': {
      status: 200,
      json: [],
    },
    'POST https://api.github.com/repos/gilcambe/nexia/issues': {
      status: 201,
      json: () => {
        chamouCriacao = true;
        return { number: 999 };
      },
    },
  };

  const resultado = await monitorarPrumo({
    env: { GITHUB_TOKEN: 'fake-token', GITHUB_REPOSITORY: 'gilcambe/nexia' },
    fetchImpl: mockFetch(rotas),
  });

  assert.strictEqual(resultado.saudavel, true);
  assert.strictEqual(resultado.acao, 'ok');
  assert.strictEqual(chamouCriacao, false);
});

test('PRUMO-MON3: primeira falha isolada não abre issue (aguarda 2ª confirmação)', async () => {
  let chamouCriacao = false;
  const rotas = {
    'https://nexia.gcbezerra.workers.dev/prumo/': { status: 500 },
    'https://nexia.gcbezerra.workers.dev/api/prumo': { status: 502 },
    'GET https://api.github.com/repos/gilcambe/nexia/issues?state=open&labels=cortex-alerta&per_page=50': {
      status: 200,
      json: [],
    },
    'GET https://api.github.com/repos/gilcambe/nexia/actions/workflows/prumo-monitor.yml/runs?per_page=5': {
      status: 200,
      json: { workflow_runs: [{ status: 'completed', conclusion: 'success' }] },
    },
    'POST https://api.github.com/repos/gilcambe/nexia/issues': {
      status: 201,
      json: () => {
        chamouCriacao = true;
        return { number: 999 };
      },
    },
  };

  const resultado = await monitorarPrumo({
    env: { GITHUB_TOKEN: 'fake-token', GITHUB_REPOSITORY: 'gilcambe/nexia' },
    fetchImpl: mockFetch(rotas),
  });

  assert.strictEqual(resultado.saudavel, false);
  assert.strictEqual(resultado.acao, 'primeira_falha');
  assert.strictEqual(resultado.consecutivas, 1);
  assert.strictEqual(chamouCriacao, false);
});

test('PRUMO-MON4: duas falhas seguidas abrem issue com título e rótulo corretos', async () => {
  let issueCriada = null;
  const rotas = {
    'https://nexia.gcbezerra.workers.dev/prumo/': { status: 503 },
    'https://nexia.gcbezerra.workers.dev/api/prumo': { status: 500 },
    'GET https://api.github.com/repos/gilcambe/nexia/issues?state=open&labels=cortex-alerta&per_page=50': {
      status: 200,
      json: [],
    },
    'GET https://api.github.com/repos/gilcambe/nexia/actions/workflows/prumo-monitor.yml/runs?per_page=5': {
      status: 200,
      json: { workflow_runs: [{ status: 'completed', conclusion: 'failure' }] },
    },
    'POST https://api.github.com/repos/gilcambe/nexia/issues': {
      status: 201,
      json: (init) => {
        return { number: 1234 };
      },
    },
  };

  const fetchImpl = async (url, init = {}) => {
    const method = init.method || 'GET';
    const chave = `${method} ${url}`;
    if (chave === 'POST https://api.github.com/repos/gilcambe/nexia/issues') {
      issueCriada = JSON.parse(init.body);
      return {
        ok: true,
        status: 201,
        json: async () => ({ number: 1234 }),
      };
    }
    return mockFetch(rotas)(url, init);
  };

  const resultado = await monitorarPrumo({
    env: { GITHUB_TOKEN: 'fake-token', GITHUB_REPOSITORY: 'gilcambe/nexia' },
    fetchImpl,
  });

  assert.strictEqual(resultado.saudavel, false);
  assert.strictEqual(resultado.acao, 'abriu_alerta');
  assert.strictEqual(resultado.consecutivas, 2);
  assert.strictEqual(resultado.issue, 1234);

  assert.ok(issueCriada, 'Deveria ter chamado a criação da issue');
  assert.strictEqual(issueCriada.title, TITULO_ALERTA);
  assert.deepStrictEqual(issueCriada.labels, [ROTULO_ALERTA]);
  assert.ok(issueCriada.body.includes('Kernex Finance fora do ar'));
  assert.ok(issueCriada.body.includes('2 falhas consecutivas'));
});

test('PRUMO-MON5: duas falhas seguidas usando parâmetro falhasPrevias=1 chama método de criação de issue', async () => {
  let issueCriada = null;
  const rotas = {
    'https://nexia.gcbezerra.workers.dev/prumo/': { status: 500 },
    'https://nexia.gcbezerra.workers.dev/api/prumo': { status: 500 },
    'GET https://api.github.com/repos/gilcambe/nexia/issues?state=open&labels=cortex-alerta&per_page=50': {
      status: 200,
      json: [],
    },
  };

  const fetchImpl = async (url, init = {}) => {
    const method = init.method || 'GET';
    const chave = `${method} ${url}`;
    if (chave === 'POST https://api.github.com/repos/gilcambe/nexia/issues') {
      issueCriada = JSON.parse(init.body);
      return {
        ok: true,
        status: 201,
        json: async () => ({ number: 4321 }),
      };
    }
    return mockFetch(rotas)(url, init);
  };

  const resultado = await monitorarPrumo({
    env: { GITHUB_TOKEN: 'fake-token', GITHUB_REPOSITORY: 'gilcambe/nexia' },
    fetchImpl,
    falhasPrevias: 1,
  });

  assert.strictEqual(resultado.saudavel, false);
  assert.strictEqual(resultado.acao, 'abriu_alerta');
  assert.strictEqual(resultado.consecutivas, 2);
  assert.strictEqual(resultado.issue, 4321);
  assert.ok(issueCriada);
  assert.strictEqual(issueCriada.title, TITULO_ALERTA);
});

test('PRUMO-MON6: se já existe issue aberta e continua falhando, comenta na issue em vez de abrir nova', async () => {
  let chamouCriar = false;
  let comentarioCriado = null;

  const rotas = {
    'https://nexia.gcbezerra.workers.dev/prumo/': { status: 500 },
    'https://nexia.gcbezerra.workers.dev/api/prumo': { status: 500 },
    'GET https://api.github.com/repos/gilcambe/nexia/issues?state=open&labels=cortex-alerta&per_page=50': {
      status: 200,
      json: [{ number: 888, title: TITULO_ALERTA }],
    },
  };

  const fetchImpl = async (url, init = {}) => {
    const method = init.method || 'GET';
    const chave = `${method} ${url}`;
    if (chave === 'POST https://api.github.com/repos/gilcambe/nexia/issues') {
      chamouCriar = true;
    }
    if (chave === 'POST https://api.github.com/repos/gilcambe/nexia/issues/888/comments') {
      comentarioCriado = JSON.parse(init.body);
      return { ok: true, status: 201, json: async () => ({ id: 1 }) };
    }
    return mockFetch(rotas)(url, init);
  };

  const resultado = await monitorarPrumo({
    env: { GITHUB_TOKEN: 'fake-token', GITHUB_REPOSITORY: 'gilcambe/nexia' },
    fetchImpl,
  });

  assert.strictEqual(resultado.saudavel, false);
  assert.strictEqual(resultado.acao, 'comentou_falha');
  assert.strictEqual(resultado.issue, 888);
  assert.strictEqual(chamouCriar, false);
  assert.ok(comentarioCriado);
  assert.ok(comentarioCriado.body.includes('Persistência de falha no Kernex Finance'));
});

test('PRUMO-MON7: ao restabelecer serviço com issue aberta, fecha a issue e avisa', async () => {
  let issueFechada = null;
  let comentarioResolucao = null;

  const rotas = {
    'https://nexia.gcbezerra.workers.dev/prumo/': { status: 200 },
    'https://nexia.gcbezerra.workers.dev/api/prumo': { status: 200 },
    'GET https://api.github.com/repos/gilcambe/nexia/issues?state=open&labels=cortex-alerta&per_page=50': {
      status: 200,
      json: [{ number: 777, title: TITULO_ALERTA }],
    },
  };

  const fetchImpl = async (url, init = {}) => {
    const method = init.method || 'GET';
    const chave = `${method} ${url}`;
    if (chave === 'POST https://api.github.com/repos/gilcambe/nexia/issues/777/comments') {
      comentarioResolucao = JSON.parse(init.body);
      return { ok: true, status: 201, json: async () => ({ id: 2 }) };
    }
    if (chave === 'PATCH https://api.github.com/repos/gilcambe/nexia/issues/777') {
      issueFechada = JSON.parse(init.body);
      return { ok: true, status: 200, json: async () => ({ number: 777, state: 'closed' }) };
    }
    return mockFetch(rotas)(url, init);
  };

  const resultado = await monitorarPrumo({
    env: { GITHUB_TOKEN: 'fake-token', GITHUB_REPOSITORY: 'gilcambe/nexia' },
    fetchImpl,
  });

  assert.strictEqual(resultado.saudavel, true);
  assert.strictEqual(resultado.acao, 'fechou_alerta');
  assert.strictEqual(resultado.issue, 777);
  assert.ok(issueFechada);
  assert.strictEqual(issueFechada.state, 'closed');
  assert.ok(comentarioResolucao);
  assert.ok(comentarioResolucao.body.includes('Kernex Finance restabelecido'));
});

test('PRUMO-MON8: contarFalhasEmComentarios extrai sequência de comentários', () => {
  assert.strictEqual(contarFalhasEmComentarios([]), 1);
  assert.strictEqual(contarFalhasEmComentarios([{ body: 'outro texto' }]), 1);
  assert.strictEqual(contarFalhasEmComentarios([
    { body: 'Falha consecutiva #2' },
    { body: 'Falha consecutiva #3' },
  ]), 4);
});
