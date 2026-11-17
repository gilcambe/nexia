'use strict';
// Contrato #3783 refeito (17/11/2026). Regra do dono (13/11): "o Cortex, sempre que não tiver um módulo, avisa um
// agente, que busca na internet e traz". O Buscador existe (nexia-ai/escritorio/buscador.js: pedidoDeBusca, termos),
// mas a Fábrica (nexia-ai/fabrica/buscar.js) só lista "faltam" e ninguém pede a busca.
// A 1ª versão deste contrato era inválida (o teste estava entre os arquivos da IA). Agora o teste é fixo.
//
// Pedido: em buscar.js, nova função exportada
//   pedirBuscaDasFaltas(faltam, { mural, registro, agora })
//     faltam:   a lista "faltam" de consultar() ([{ pedido, nivel }])
//     mural:    { postar(recado) } (injetado; no ar é o mural do Escritório)
//     registro: { get(termo) -> epochMs|undefined, set(termo, epochMs) } (injetado; guarda quando pediu)
//     agora:    epochMs
//   Para cada falta: termo = termos(pedido) do Buscador; se o MESMO termo foi pedido há menos de 24 h, não pede de
//   novo; senão posta pedidoDeBusca(pedido, 'fabrica') no mural e guarda no registro.
//   Devolve [{ pedido, termos, pediuBusca }].
// E consultar(ficha, cat, opcoes): quando opcoes.mural vier, o resultado ganha `buscas` (o retorno acima);
// sem opcoes, nada muda (compatível).
const test = require('node:test');
const assert = require('node:assert/strict');
const { consultar, pedirBuscaDasFaltas } = require('../../nexia-ai/fabrica/buscar');
const { termos } = require('../../nexia-ai/escritorio/buscador');

const CAT = {
  ramos: { saude: ['dentista', 'clinica'] },
  modulos: [{ id: 'agenda', nome: 'Agenda', apelidos: ['marcar horário'], pronto: true, nivel: 1 }],
  modelos: [{ id: 'demo-agenda', nome: 'Agenda', nichos: ['saude'], modulos: ['agenda'], clonavel: true }],
};
const FICHA = { nome: 'Clínica Sorriso', ramo: 'dentista', cidade: 'Recife', precisa: ['agenda', 'controle de estoque'] };
function mural() { const recados = []; return { recados, postar: (r) => recados.push(r) }; }
function registro() { const m = new Map(); return { m, get: (k) => m.get(k), set: (k, v) => m.set(k, v) }; }
const H = 3600 * 1000;

test('módulo que existe não vira busca; o que falta vira UM recado ao Buscador no mural', () => {
  const r = consultar(FICHA, CAT);
  assert.deepEqual(r.faltam.map((x) => x.pedido), ['controle de estoque']);
  const mu = mural(); const re = registro();
  const out = pedirBuscaDasFaltas(r.faltam, { mural: mu, registro: re, agora: Date.parse('2026-11-17T10:00:00Z') });
  assert.equal(out.length, 1);
  assert.equal(out[0].pedido, 'controle de estoque');
  assert.equal(out[0].pediuBusca, true);
  assert.equal(out[0].termos, termos('controle de estoque'));
  assert.equal(mu.recados.length, 1);
  assert.equal(mu.recados[0].para, 'buscador');
  assert.equal(mu.recados[0].area, 'fabrica');
  assert.match(mu.recados[0].texto, /controle de estoque/);
});

test('mesmo termo em menos de 24 h não pede de novo; depois de 24 h pede', () => {
  const mu = mural(); const re = registro(); const t0 = Date.parse('2026-11-17T10:00:00Z');
  pedirBuscaDasFaltas([{ pedido: 'controle de estoque', nivel: 2 }], { mural: mu, registro: re, agora: t0 });
  const de2 = pedirBuscaDasFaltas([{ pedido: 'Controle de Estoque', nivel: 2 }], { mural: mu, registro: re, agora: t0 + 23 * H });
  assert.equal(de2[0].pediuBusca, false, 'mesmo termo (sem diferença de maiúscula) em 23 h: não repete');
  assert.equal(mu.recados.length, 1);
  const de3 = pedirBuscaDasFaltas([{ pedido: 'controle de estoque', nivel: 2 }], { mural: mu, registro: re, agora: t0 + 25 * H });
  assert.equal(de3[0].pediuBusca, true, 'passou de 24 h: pede de novo');
  assert.equal(mu.recados.length, 2);
});

test('consultar com opcoes.mural já devolve as buscas; sem opcoes continua igual', () => {
  const mu = mural(); const re = registro();
  const r = consultar(FICHA, CAT, { mural: mu, registro: re, agora: Date.parse('2026-11-17T10:00:00Z') });
  assert.equal(r.buscas.length, 1);
  assert.equal(r.buscas[0].pediuBusca, true);
  assert.equal(mu.recados.length, 1);
  const semOp = consultar(FICHA, CAT);
  assert.equal(semOp.buscas, undefined, 'sem opcoes, o resultado não muda');
  assert.equal(semOp.faltam.length, 1);
});

test('nada faltando: nenhum recado', () => {
  const mu = mural();
  const r = consultar({ ...FICHA, precisa: ['agenda'] }, CAT, { mural: mu, registro: registro(), agora: 0 });
  assert.deepEqual(r.buscas, []);
  assert.equal(mu.recados.length, 0);
});
