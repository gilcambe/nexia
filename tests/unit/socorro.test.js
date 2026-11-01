'use strict';
// #2324 + #2718: socorro, botão de emergência e "ajuda das IAs conectadas" por tarefa.
// (Antes este teste trocava um "rodar" de central/github.js que não existe; no servidor o socorro quebrava.)
const test = require('node:test');
const assert = require('node:assert/strict');

const CAMINHO_ACOES = '../../netlify/functions/central/pedidos-acoes.js';
const CAMINHO_JULES = '../../netlify/functions/central/pedidos-jules.js';

const h = (n) => new Date(Date.now() - n * 36e5).toISOString();
const TRAVADAS = [
  { number: 1, title: 'Issue 1', html_url: 'u1', labels: [{ name: 'cortex-travado' }], updated_at: h(2) },
  { number: 2, title: 'Issue 2 (reserva acabou de tentar)', html_url: 'u2', labels: [{ name: 'cortex-travado' }, { name: 'reserva-tentou' }], updated_at: h(2) },
  { number: 3, title: 'Issue 3', html_url: 'u3', labels: [{ name: 'cortex-travado' }, { name: 'reserva-tentativa-1' }, { name: 'reserva-tentativa-2' }], updated_at: h(8) },
  { number: 5, title: 'Mexe em .github/workflows/x.yml', html_url: 'u5', labels: [{ name: 'cortex-travado' }], updated_at: h(1) },
];

function montar() {
  const chamadas = [];
  let julesN = 0;
  require.cache[require.resolve(CAMINHO_JULES)] = { exports: { mandarParaJules: async () => { julesN++; return { status: 200, corpo: { ok: true } }; } } };
  delete require.cache[require.resolve(CAMINHO_ACOES)];
  const acoes = require(CAMINHO_ACOES);
  const pausas = [];
  const p = { gh: async (url, init = {}) => {
    chamadas.push({ url, metodo: init.method || 'GET', corpo: init.body ? JSON.parse(init.body) : null });
    if (url.includes('labels=cortex-travado')) return TRAVADAS;
    if (url.includes('labels=fila-pausada')) return pausas;
    if (url.endsWith('/issues') && init.method === 'POST') { pausas.push({ number: 77 }); return { number: 77 }; }
    return {};
  } };
  return { acoes, p, chamadas, jules: () => julesN };
}
const despachos = (c) => c.filter((x) => x.url.endsWith('/actions/workflows/cortex-reserva.yml/dispatches'));

test('SOS1. sem Jules: travadas vão para as IAs conectadas (pula a que a reserva acabou de tentar)', async () => {
  const m = montar();
  const r = await m.acoes.agir(m.p, { acao: 'socorro', jules: false }, 'dono');
  assert.equal(r.status, 200);
  assert.equal(r.corpo.ias, 3);
  assert.equal(r.corpo.jules, 0);
  assert.deepEqual(despachos(m.chamadas).map((x) => x.corpo.inputs.numero), ['1', '3', '5']);
  assert.ok(m.chamadas[0].url.includes('?state=open&labels=cortex-travado'), 'lista por query string, não por corpo de GET');
});

test('SOS2. com Jules: workflow e 2x reserva vão ao Jules; o resto às IAs conectadas', async () => {
  const m = montar();
  const r = await m.acoes.agir(m.p, { acao: 'socorro', jules: true }, 'dono');
  assert.equal(r.corpo.jules, 2);
  assert.equal(r.corpo.ias, 1);
  assert.equal(m.jules(), 2);
});

test('SOS3. ajuda das IAs conectadas numa tarefa dispara a Reserva com o número', async () => {
  const m = montar();
  const r = await m.acoes.agir(m.p, { acao: 'reserva', n: 42 }, 'dono');
  assert.equal(r.status, 200);
  assert.deepEqual(despachos(m.chamadas)[0].corpo, { ref: 'develop', inputs: { numero: '42' } });
});

test('SOS4. botão de emergência abre a issue fila-pausada uma vez e "voltar" fecha', async () => {
  const m = montar();
  await m.acoes.agir(m.p, { acao: 'pausar-fila' }, 'dono');
  await m.acoes.agir(m.p, { acao: 'pausar-fila' }, 'dono');
  const criadas = m.chamadas.filter((x) => x.url.endsWith('/issues') && x.metodo === 'POST');
  assert.equal(criadas.length, 1);
  assert.deepEqual(criadas[0].corpo.labels, ['cortex-fila', 'fila-pausada']);
  const r = await m.acoes.agir(m.p, { acao: 'voltar-fila' }, 'dono');
  assert.equal(r.corpo.pausada, false);
  assert.ok(m.chamadas.some((x) => x.url.endsWith('/issues/77') && x.metodo === 'PATCH' && x.corpo.state === 'closed'));
});
