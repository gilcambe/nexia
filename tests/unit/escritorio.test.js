'use strict';
// Fase 8 (13/11/2026): Escritório da KERNEX — áreas com 3+ agentes, mural, Diretor e rotas da Central.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createMemoryDriver } = require('../../lib/firebase-lite/d1-backend');
const { AREAS, MINIMO_POR_AREA } = require('../../nexia-ai/escritorio/areas');
const { createMural } = require('../../nexia-ai/escritorio/mural');
const { montarResumo, cobrancas, PRAZO_H } = require('../../nexia-ai/escritorio/diretor');
const { rota } = require('../../netlify/functions/central/escritorio');
const { rodar } = require('../../scripts/escritorio-diretor');

const novo = (agora = () => new Date('2026-11-13T12:00:00Z')) => createMural({ env: {}, driver: createMemoryDriver(), agora });

test('ES1. regra do dono: toda área tem no mínimo 3 agentes, ids únicos, e o que mexe em dinheiro/contrato pede OK', () => {
  const ids = new Set();
  for (const a of AREAS) {
    assert.ok(a.agentes.length >= MINIMO_POR_AREA, `${a.id} tem ${a.agentes.length}`);
    assert.ok(new Set(a.agentes.map((x) => x.ia)).size >= 2, `${a.id}: IAs diferentes para não cair tudo junto`);
    for (const g of a.agentes) { assert.ok(!ids.has(g.id)); ids.add(g.id); }
  }
  for (const id of ['prospeccao', 'marketing', 'comercial', 'viabilidade', 'buscador', 'juridico', 'producao', 'suporte', 'financeiro', 'ti', 'rh', 'diretoria']) assert.ok(AREAS.some((a) => a.id === id), id);
  assert.ok(AREAS.find((a) => a.id === 'financeiro').precisaOk.some((x) => /dinheiro/.test(x)));
  assert.ok(AREAS.find((a) => a.id === 'juridico').precisaOk.some((x) => /contrato/.test(x)));
});

test('ES2. mural: posta, filtra por área (inclusive "para"), recusa área/tipo inválidos', async () => {
  const m = novo();
  await m.postar({ area: 'prospeccao', agente: 'Caçador', tipo: 'pedido', para: 'comercial', texto: '12 barbearias sem site em Recife' });
  await m.postar({ area: 'marketing', tipo: 'feito', texto: 'Post do dia publicado' });
  assert.equal((await m.listar({ area: 'comercial' })).length, 1, 'pedido para o comercial aparece na área dele');
  assert.equal((await m.listar({ tipo: 'feito' }))[0].status, 'feito');
  await assert.rejects(m.postar({ area: 'xyz', texto: 'a' }), /área inválida/);
  await assert.rejects(m.postar({ area: 'rh', tipo: 'spam', texto: 'a' }), /tipo inválido/);
  await assert.rejects(m.postar({ area: 'rh', texto: '   ' }), /texto vazio/);
});

test('ES3. só o dono decide um precisa-ok, uma vez só', async () => {
  const m = novo();
  const r = await m.postar({ area: 'financeiro', tipo: 'precisa-ok', texto: 'Gerar Pix de R$ 300 para Barbearia do João' });
  const info = await m.postar({ area: 'rh', texto: 'oi' });
  assert.equal((await m.decidir(info.id, true)).erro, 'este recado não pede OK');
  const ok = await m.decidir(r.id, true, 'pode');
  assert.equal(ok.status, 'aprovado');
  assert.equal((await m.decidir(r.id, false)).erro, 'já foi decidido');
});

test('ES4. Diretor: resumo diz o que espera o dono, o que atrasou, e cobra uma vez só', async () => {
  const m = novo(() => new Date('2026-11-12T08:00:00Z'));
  const ped = await m.postar({ area: 'prospeccao', tipo: 'pedido', para: 'comercial', texto: 'Ligar para 3 leads quentes' });
  await m.postar({ area: 'juridico', tipo: 'precisa-ok', texto: 'Contrato da Clínica Sorriso pronto para revisar' });
  const agora = new Date(Date.parse('2026-11-12T08:00:00Z') + (PRAZO_H + 2) * 3600e3).toISOString();
  const recados = await m.listar({ limite: 500 });
  const res = montarResumo(recados, agora);
  assert.match(res.titulo, /1 coisa\(s\) esperando o seu OK/);
  assert.equal(res.atrasados.length, 1);
  assert.match(res.texto, /Jurídico e contratos: Contrato da Clínica Sorriso/);
  const c = cobrancas(recados, agora);
  assert.equal(c.length, 1); assert.equal(c[0].para, 'comercial'); assert.equal(c[0].ref.id, ped.id);
  assert.equal(cobrancas([...recados, { ...c[0], id: 'x', em: agora, status: 'aberto' }], agora).length, 0, 'não cobra duas vezes');
});

test('ES5. rotas da Central: áreas sem banco; mural/resumo/ok/postar com banco; sem banco = 503', async () => {
  assert.equal((await rota({ parte: 'escritorio-areas' }, {})).corpo.areas.length, AREAS.length);
  const sem = await rota({ parte: 'escritorio-mural' }, { env: {} });
  assert.equal(sem.status, 503);
  const m = novo();
  const p = await rota({ acao: 'escritorio-postar', body: { area: 'comercial', texto: 'Priorize as clínicas', tipo: 'pedido' } }, { mural: m });
  assert.equal(p.corpo.recado.agente, 'Dono');
  const pre = await m.postar({ area: 'financeiro', tipo: 'precisa-ok', texto: 'Pix' });
  assert.equal((await rota({ acao: 'escritorio-ok', body: { id: pre.id } }, { mural: m })).status, 400);
  assert.equal((await rota({ acao: 'escritorio-ok', body: { id: pre.id, aprovado: false } }, { mural: m })).corpo.recado.status, 'recusado');
  assert.equal((await rota({ parte: 'escritorio-mural', query: { area: 'comercial' } }, { mural: m })).corpo.recados.length, 1);
  assert.ok((await rota({ parte: 'escritorio-resumo' }, { mural: m })).corpo.texto.startsWith('Resumo da KERNEX'));
  assert.equal(await rota({ parte: 'outra-coisa' }, { mural: m }), null);
});

test('ES6. rodada do Diretor posta cobranças e o resumo no mural', async () => {
  const m = novo(() => new Date('2026-11-10T08:00:00Z'));
  await m.postar({ area: 'marketing', tipo: 'pedido', para: 'producao', texto: 'Página de portfólio' });
  const linhas = [];
  const r = await rodar({ mural: m, agora: '2026-11-13T11:00:00Z', log: (x) => linhas.push(x) });
  assert.equal(r.ok, true); assert.equal(r.cobrancas, 1);
  assert.ok((await m.listar({ area: 'diretoria' })).some((x) => /^Resumo:/.test(x.texto)));
  assert.ok(linhas.join('\n').includes('Resumo da KERNEX'));
});
