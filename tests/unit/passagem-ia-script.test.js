'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { rodar, criarGh } = require('../../scripts/passagem-ia');
const { escreverRegistro } = require('../../nexia-ai/passagem/registro');

test('PI1. sem token o script não quebra e não faz nada', async () => {
  const linhas = [];
  const out = await rodar({ gh: null, log: (l) => linhas.push(l) });
  assert.deepStrictEqual(out.criadas, []);
  assert.match(linhas[0], /sem token/);
});

test('PI2. com gh falso, passa o item de um registro parado e escreve o resumo', async () => {
  const corpo = escreverRegistro('reg', { quem: 'claude', repo: 'gilcambe/nexia', sinal: new Date(Date.now() - 30 * 60000).toISOString(), itens: [{ t: 'Fazer X', feito: false }], estado: 'trabalhando' });
  const postadas = [];
  const gh = async (caminho, opts = {}) => {
    if ((opts.method || 'GET') === 'GET') return caminho.includes('labels=trabalho-ativo') ? [{ number: 5, body: corpo }] : [];
    if (/\/issues$/.test(caminho)) { postadas.push(JSON.parse(opts.body)); return { number: 77 }; }
    return {};
  };
  const linhas = [];
  const out = await rodar({ gh, log: (l) => linhas.push(l) });
  assert.strictEqual(out.criadas.length, 1);
  assert.strictEqual(postadas[0].title, 'Fazer X');
  assert.match(linhas.join('\n'), /1 parada\(s\), 1 issue\(s\) criada\(s\)/);
});

test('PI3. criarGh manda o token no cabeçalho e devolve o erro do GitHub com o código', async () => {
  let pedido;
  const gh = criarGh('tk', async (url, init) => { pedido = { url, init }; return { ok: false, status: 403, text: async () => 'proibido' }; });
  await assert.rejects(gh('/repos/a/b/issues'), (e) => e.status === 403 && /GitHub 403/.test(e.message));
  assert.strictEqual(pedido.init.headers.Authorization, 'Bearer tk');
  assert.strictEqual(pedido.url, 'https://api.github.com/repos/a/b/issues');
});

test('PI4. se a issue não abre (sem acesso ao repo), o registro não vira "passado" e tenta de novo depois', async () => {
  const corpo = escreverRegistro('reg', { quem: 'claude', repo: 'gilcambe/avaya-gsd', sinal: new Date(Date.now() - 30 * 60000).toISOString(), itens: [{ t: 'Item', feito: false }], estado: 'trabalhando' });
  const patches = [];
  const gh = async (caminho, opts = {}) => {
    const m = opts.method || 'GET';
    if (m === 'GET') return caminho.includes('labels=trabalho-ativo') ? [{ number: 6, body: corpo }] : [];
    if (m === 'PATCH') { patches.push(caminho); return {}; }
    if (/\/issues$/.test(caminho)) throw Object.assign(new Error('GitHub 404'), { status: 404 });
    return {};
  };
  const out = await rodar({ gh, log: () => {} });
  assert.strictEqual(out.criadas.length, 0);
  assert.strictEqual(patches.length, 0);
  assert.strictEqual(out.paradas[0].falhas, 1);
});
