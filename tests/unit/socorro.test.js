'use strict';
const test = require('node:test');
const assert = require('node:assert');

const CAMINHO_ACOES = '../../netlify/functions/central/pedidos-acoes.js';
const CAMINHO_JULES = '../../netlify/functions/central/pedidos-jules.js';
const CAMINHO_GITHUB = '../../netlify/functions/central/github.js';

// --- Mock do objeto p (com metodo gh) ---
const chamadasGh = [];
const mockGh = async function(url, options = {}) {
  chamadasGh.push({ url, options });
  if (url === '/repos/gilcambe/nexia/issues') {
    return [
      { number: 1, title: 'Issue 1 travada', html_url: 'https://github.com/gilcambe/nexia/issues/1', labels: [{ name: 'cortex-travado' }], updated_at: new Date(Date.now() - 2 * 36e5).toISOString(), body: '' },
      { number: 2, title: 'Issue 2 travada', html_url: 'https://github.com/gilcambe/nexia/issues/2', labels: [{ name: 'cortex-travado' }, { name: 'reserva-tentou' }], updated_at: new Date(Date.now() - 2 * 36e5).toISOString(), body: '' },
      { number: 3, title: 'Issue 3 travada (duas reservas)', html_url: 'https://github.com/gilcambe/nexia/issues/3', labels: [{ name: 'cortex-travado' }, { name: 'reserva-tentativa-1' }, { name: 'reserva-tentativa-2' }], updated_at: new Date(Date.now() - 8 * 36e5).toISOString(), body: '' },
      { number: 4, title: 'Issue 4 travada (duas reservas)', html_url: 'https://github.com/gilcambe/nexia/issues/4', labels: [{ name: 'cortex-travado' }, { name: 'reserva-tentativa-1' }, { name: 'reserva-tentativa-2' }], updated_at: new Date(Date.now() - 10 * 36e5).toISOString(), body: '' },
      { number: 5, title: 'Issue 5 menciona .github/workflows/ no titulo', html_url: 'https://github.com/gilcambe/nexia/issues/5', labels: [{ name: 'cortex-travado' }], updated_at: new Date(Date.now() - 1 * 36e5).toISOString(), body: '' }
    ];
  }
  // getIssue: /repos/gilcambe/nexia/issues/N
  const m = url.match(/\/repos\/gilcambe\/nexia\/issues\/(\d+)$/);
  if (m) {
    const n = Number(m[1]);
    const base = await mockGh('/repos/gilcambe/nexia/issues');
    return base.find(i => i.number === n) || {};
  }
  // addLabels: POST /repos/gilcambe/nexia/issues/N/labels
  if (url.endsWith('/labels') && options.method === 'POST') {
    return { success: true };
  }
  return {};
};

const p = { gh: mockGh };

let chamadasJules = 0;
let chamadasRodar = 0;
const mockMandarParaJules = async function() { chamadasJules++; return { status: 200, corpo: { ok: true } }; };
const mockRodar = async function() { chamadasRodar++; return { success: true }; };

function injetarMocks() {
  require.cache[require.resolve(CAMINHO_JULES)] = { exports: { mandarParaJules: mockMandarParaJules, montarPrompt: () => {}, REGRAS: '' } };
  require.cache[require.resolve(CAMINHO_GITHUB)] = { exports: { rodar: mockRodar } };
}

function limparCache() {
  delete require.cache[require.resolve(CAMINHO_ACOES)];
  delete require.cache[require.resolve(CAMINHO_JULES)];
  delete require.cache[require.resolve(CAMINHO_GITHUB)];
}

function reset() {
  chamadasGh.length = 0;
  chamadasJules = 0;
  chamadasRodar = 0;
}

test('socorro: jules true - no maximo 3 para Jules, criterio restrito', async () => {
  reset();
  limparCache();
  injetarMocks();
  const { socorro } = require(CAMINHO_ACOES);
  const resultado = await socorro(p, { jules: true });
  const paraJules = resultado.filter(r => r.para === 'jules');
  const paraReserva = resultado.filter(r => r.para === 'reserva');
  assert.strictEqual(paraJules.length, 3, 'deve enviar no maximo 3 ao Jules');
  assert.strictEqual(chamadasJules, 3, 'deve chamar mandarParaJules 3 vezes');
  assert.strictEqual(paraReserva.length, 0, 'com jules true nao deve enviar para reserva');
  for (const r of resultado) {
    assert.ok(typeof r.numero === 'number', 'numero deve existir');
    assert.ok(typeof r.titulo === 'string', 'titulo deve existir');
    assert.ok(typeof r.para === 'string', 'para deve existir');
    assert.ok(typeof r.link === 'string', 'link deve existir');
  }
});

test('socorro: jules false - nenhuma vai ao Jules, criterio vai para reserva', async () => {
  reset();
  limparCache();
  injetarMocks();
  const { socorro } = require(CAMINHO_ACOES);
  const resultado = await socorro(p, { jules: false });
  const paraJules = resultado.filter(r => r.para === 'jules');
  const paraReserva = resultado.filter(r => r.para === 'reserva');
  assert.strictEqual(paraJules.length, 0, 'nenhuma issue deve ir ao Jules');
  assert.strictEqual(chamadasRodar, 3, 'deve chamar rodar 3 vezes (issues 3, 4, 5)');
  assert.strictEqual(paraReserva.length, 3, '3 issues devem ir para reserva');
});

test('socorro: reserva-tentou nas ultimas 6h e ignorada', async () => {
  reset();
  limparCache();
  injetarMocks();
  const { socorro } = require(CAMINHO_ACOES);
  const resultado = await socorro(p, { jules: true });
  const numeros = resultado.map(r => r.numero);
  assert.ok(!numeros.includes(2), 'issue 2 com reserva-tentou nas 6h deve ser ignorada');
  assert.ok(numeros.includes(5), 'issue 5 (workflow) deve ser processada');
  assert.ok(chamadasGh.some(c => c.url === '/repos/gilcambe/nexia/issues'), 'deve listar issues');
});

test('socorro: getIssue e addLabels estao disponíveis no mock gh', async () => {
  reset();
  const issue5 = await p.gh('/repos/gilcambe/nexia/issues/5');
  assert.strictEqual(issue5.number, 5, 'getIssue deve retornar a issue 5');
  await p.gh('/repos/gilcambe/nexia/issues/5/labels', { method: 'POST', body: JSON.stringify({ labels: ['teste'] }) });
  assert.ok(chamadasGh.some(c => c.url.endsWith('/labels') && c.options.method === 'POST'), 'addLabels deve ser chamada via gh');
});
