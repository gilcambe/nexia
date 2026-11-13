'use strict';
// Fase 4 (13/11/2026): prospecção pelo OpenStreetMap + funil + rotas da Central.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createMemoryDriver } = require('../../lib/firebase-lite/d1-backend');
const osm = require('../../nexia-ai/vendas/osm');
const { createProspects, mensagemAbordagem, linkWhats } = require('../../nexia-ai/vendas/prospects');
const { createMural } = require('../../nexia-ai/escritorio/mural');
const { rota } = require('../../netlify/functions/central/vendas');

const OVERPASS = { elements: [
  { type: 'node', id: 1, tags: { name: 'Barbearia do João', phone: '(81) 98888-7777', 'addr:street': 'Rua A', 'addr:housenumber': '10' } },
  { type: 'node', id: 2, tags: { name: 'Corte Fino', phone: '+55 81 3222-1111', website: 'https://cortefino.com.br' } },
  { type: 'way', id: 3, tags: { name: 'Sem Telefone Barber' } },
  { type: 'node', id: 4, tags: { shop: 'hairdresser' } },
] };
const fetchOk = (json = OVERPASS) => async (url, init) => { fetchOk.ultima = { url, init }; return { ok: true, status: 200, json: async () => json }; };

test('VD1. ramo do jeito que o dono fala vira filtro do OpenStreetMap; consulta só no Brasil e no município', () => {
  assert.equal(osm.ramoId('Pet Shop'), 'petshop');
  assert.equal(osm.ramoId('salão de beleza'), 'salao');
  assert.equal(osm.ramoId('Clínica médica'), 'clinica');
  assert.equal(osm.ramoId('astronauta'), null);
  const q = osm.montarConsulta('pizzaria', 'Recife');
  assert.match(q, /area\["ISO3166-1"="BR"\]/);
  assert.match(q, /\["name"="Recife"\]\["admin_level"="8"\]/);
  assert.match(q, /nwr\[amenity="restaurant"\]\[cuisine="pizza"\]\(area\.c\);/);
  assert.throws(() => osm.montarConsulta('astronauta', 'Recife'), /ramo desconhecido/);
  assert.doesNotMatch(osm.montarConsulta('barbearia', 'Re"cife'), /Re"cife/, 'aspas da cidade não quebram a consulta');
});

test('VD2. normaliza: telefone vira WhatsApp 55DDD, quem não tem site e tem WhatsApp é "quente" e vem primeiro', () => {
  assert.equal(osm.telefoneWhats('(81) 98888-7777'), '5581988887777');
  assert.equal(osm.telefoneWhats('+55 81 3222-1111'), '558132221111');
  assert.equal(osm.telefoneWhats('190'), '');
  const r = osm.normalizar(OVERPASS, { ramo: 'barbearia', cidade: 'Recife' });
  assert.equal(r.length, 3, 'sem nome fica de fora');
  assert.equal(r[0].nome, 'Barbearia do João'); assert.equal(r[0].quente, true); assert.equal(r[0].endereco, 'Rua A, 10');
  assert.equal(r.find((x) => x.nome === 'Corte Fino').quente, false);
});

test('VD3. funil: não repete quem já achou, muda etapa, "não quer" é definitivo', async () => {
  const pr = createProspects({ env: {}, driver: createMemoryDriver() });
  const lista = osm.normalizar(OVERPASS, { ramo: 'barbearia', cidade: 'Recife' });
  assert.deepEqual(await pr.salvar(lista), { novos: 3, repetidos: 0 });
  assert.deepEqual(await pr.salvar(lista), { novos: 0, repetidos: 3 });
  const id = lista[0].id;
  assert.equal((await pr.mudarEtapa(id, 'contatado', 'mandei msg')).etapa, 'contatado');
  assert.equal((await pr.mudarEtapa(id, 'voando')).erro, 'etapa inválida');
  await pr.mudarEtapa(id, 'nao-quer');
  assert.match((await pr.mudarEtapa(id, 'proposta')).erro, /pediu para não ser contatada/);
  assert.equal((await pr.contagem())['nao-quer'], 1);
  assert.equal((await pr.listar({ quente: true })).length, 0, 'o único quente pediu para sair');
});

test('VD4. mensagem: educada, fala do site que falta, tem saída ("sair"); link wa.me só com WhatsApp', () => {
  const [p] = osm.normalizar(OVERPASS, { ramo: 'barbearia', cidade: 'Recife' });
  const m = mensagemAbordagem(p);
  assert.match(m, /Olá, Barbearia do João!/);
  assert.match(m, /não achei um site/);
  assert.match(m, /responder "sair"/);
  assert.match(linkWhats(p, m), /^https:\/\/wa\.me\/5581988887777\?text=/);
  assert.equal(linkWhats({ whatsapp: '' }, m), '');
});

test('VD5. rotas: buscar grava no funil e avisa o mural (feito + precisa-ok); listar traz mensagem e link; sem banco = 503', async () => {
  assert.ok((await rota({ parte: 'vendas-ramos' }, {})).corpo.ramos.includes('barbearia'));
  assert.equal((await rota({ parte: 'vendas-prospects' }, { env: {} })).status, 503);
  const pr = createProspects({ env: {}, driver: createMemoryDriver() });
  const mural = createMural({ env: {}, driver: createMemoryDriver() });
  const b = await rota({ acao: 'vendas-buscar', body: { ramo: 'barbearia', cidade: 'Recife' } }, { prospects: pr, mural, fetchFn: fetchOk() });
  assert.deepEqual(b.corpo, { achados: 3, novos: 3, repetidos: 0, quentes: 1 });
  assert.match(fetchOk.ultima.url, /overpass-api\.de/);
  const recs = await mural.listar();
  assert.ok(recs.some((x) => x.tipo === 'feito' && x.area === 'prospeccao'));
  assert.ok(recs.some((x) => x.tipo === 'precisa-ok' && x.para === 'comercial'));
  const l = await rota({ parte: 'vendas-prospects', query: { quente: '1' } }, { prospects: pr });
  assert.equal(l.corpo.prospects.length, 1);
  assert.match(l.corpo.prospects[0].linkWhats, /^https:\/\/wa\.me\//);
  assert.equal(l.corpo.contagem.novo, 3);
  assert.equal((await rota({ acao: 'vendas-buscar', body: { ramo: 'astronauta', cidade: 'Recife' } }, { prospects: pr, mural, fetchFn: fetchOk() })).status, 400);
  const e = await rota({ acao: 'vendas-etapa', body: { id: l.corpo.prospects[0].id, etapa: 'proposta' } }, { prospects: pr });
  assert.equal(e.corpo.prospect.etapa, 'proposta');
});
