'use strict';
// Kernex Store S2 (13/11/2026): servidor da Store na Central (lista módulos/clientes, dispara o instalador).
const test = require('node:test');
const assert = require('node:assert');
const { rota } = require('../../netlify/functions/central/fabrica');

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64');
function ghFalso(chamadas = []) {
  return async (caminho, init = {}) => {
    chamadas.push({ caminho, init });
    if (caminho.startsWith('/repos/gilcambe/kernex-clientes/contents/modulos?')) return [{ type: 'dir', name: 'agenda' }, { type: 'file', name: 'LEIA.md' }];
    if (caminho.startsWith('/repos/gilcambe/kernex-clientes/contents/clientes?')) return [{ type: 'dir', name: 'demo-loja' }, { type: 'dir', name: 'studiolima' }, { type: 'dir', name: '../x' }];
    if (caminho.includes('/modulos/agenda/modulo.json')) return { content: b64({ id: 'agenda', nome: 'Agenda online', faz: 'agenda', versao: '1.0.0', preco: { mensal: 0, gratis_dias: 30 } }) };
    if (caminho.includes('/runs?')) return { workflow_runs: [{ display_title: 'Store instalar agenda em studiolima', status: 'completed', conclusion: 'success', html_url: 'https://x' }] };
    if (init.method === 'POST') return {};
    throw new Error('inesperado ' + caminho);
  };
}

test('ST1. lista módulos da Store e só clientes de verdade (sem demo-*, sem nome inválido)', async () => {
  const r = await rota({ parte: 'fabrica-store' }, { gh: ghFalso() });
  assert.equal(r.status, 200);
  assert.deepEqual(r.corpo.modulos.map(m => m.id), ['agenda']);
  assert.equal(r.corpo.modulos[0].preco.mensal, 0);
  assert.deepEqual(r.corpo.clientes, ['studiolima']);
});

test('ST2. instalar dispara modulo-instalar.yml no main com os dados certos', async () => {
  const ch = [];
  const r = await rota({ acao: 'fabrica-store-instalar', body: { cliente: 'studiolima', modulo: 'agenda' } }, { gh: ghFalso(ch) });
  assert.equal(r.status, 200);
  const post = ch.find(c => c.init.method === 'POST');
  assert.match(post.caminho, /kernex-clientes\/actions\/workflows\/modulo-instalar\.yml\/dispatches$/);
  assert.deepEqual(JSON.parse(post.init.body), { ref: 'main', inputs: { cliente: 'studiolima', modulo: 'agenda', acao: 'instalar', cor: '' } });
  const ch2 = [];
  await rota({ acao: 'fabrica-store-instalar', body: { acao: 'fabrica-store-instalar', cliente: 'studiolima', modulo: 'agenda', tirar: true } }, { gh: ghFalso(ch2) });
  assert.equal(JSON.parse(ch2.find(c => c.init.method === 'POST').init.body).inputs.acao, 'tirar');
});

test('ST3. recusa cliente/módulo/cor inválidos e modelos demo-*', async () => {
  for (const body of [{ cliente: '../x', modulo: 'agenda' }, { cliente: 'demo-loja', modulo: 'agenda' }, { cliente: 'studiolima', modulo: 'a b' }, { cliente: 'studiolima', modulo: 'agenda', cor: 'red"><script>' }]) {
    const ch = [];
    const r = await rota({ acao: 'fabrica-store-instalar', body }, { gh: ghFalso(ch) });
    assert.equal(r.status, 400, JSON.stringify(body));
    assert.equal(ch.length, 0, 'não chama o GitHub');
  }
});

test('ST4. status acha a execução pelo título (cliente e módulo)', async () => {
  const r = await rota({ parte: 'fabrica-store-status', query: { cliente: 'studiolima', modulo: 'agenda' } }, { gh: ghFalso() });
  assert.equal(r.corpo.status, 'ok');
  const n = await rota({ parte: 'fabrica-store-status', query: { cliente: 'outro', modulo: 'agenda' } }, { gh: ghFalso() });
  assert.equal(n.corpo.status, 'nada');
});
