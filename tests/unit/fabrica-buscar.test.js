'use strict';
// Fábrica por módulos (M1, 12/11/2026): a Biblioteca guarda tudo que já existe; o buscador lê a ficha do sistema novo
// e diz o que é pronto (copia), parecido (adapta) e o que falta (só isso vai para o Cortex).
const test = require('node:test');
const assert = require('node:assert/strict');
const { carregar, validarCatalogo } = require('../../nexia-ai/fabrica/catalogo');
const { normalizarFicha, validarFicha } = require('../../nexia-ai/fabrica/ficha');
const { consultar } = require('../../nexia-ai/fabrica/buscar');

const cat = carregar();

test('FB1. a Biblioteca é válida: ids únicos, modelos só usam módulos que existem, nada de dado pessoal', () => {
  assert.deepEqual(validarCatalogo(cat), []);
  assert.ok(cat.modulos.length >= 15, 'tudo que já existe precisa estar na memória');
  assert.ok(cat.modelos.some(m => m.id === 'demo-viagens' && m.clonavel));
  assert.doesNotMatch(JSON.stringify(cat), /@gmail\.com|\b55\d{10,11}\b|\b(senha|token)\s*[:=]/i);
  assert.match(JSON.stringify({ x: 'contato@cliente.com' }), require('../../nexia-ai/fabrica/catalogo').DADO_SENSIVEL);
});

test('FB2. ficha: normaliza ramo e "precisa" e valida o mínimo', () => {
  const f = normalizarFicha({ nome: ' Clínica Sorriso ', ramo: 'Dentista', whatsapp: '(81) 99999-9999', precisa: ['Agenda', 'agenda', ' site '] });
  assert.equal(f.slug, 'clinica-sorriso');
  assert.equal(f.ramo, 'dentista');
  assert.equal(f.whatsapp, '5581999999999');
  assert.deepEqual(f.precisa, ['agenda', 'site']);
  assert.deepEqual(validarFicha(f), []);
  assert.ok(validarFicha(normalizarFicha({ nome: 'X' })).length >= 2);
});

test('FB3. clínica de dentista: agenda e site já existem (modelo de agenda), pagamento vira "falta" nível 3', () => {
  const r = consultar({ nome: 'Clínica Sorriso', ramo: 'dentista', whatsapp: '81999999999', precisa: ['agenda', 'site', 'whatsapp', 'pagamento'] }, cat);
  assert.deepEqual(r.erros, []);
  assert.equal(r.modelo.id, 'demo-agenda');
  assert.equal(r.modelo.clonavel, true);
  for (const id of ['agenda', 'site', 'whatsapp']) assert.ok(r.prontos.some(m => m.id === id), `${id} pronto`);
  assert.deepEqual(r.faltam.map(m => m.pedido), ['pagamento']);
  assert.equal(r.nivel, 3);
});

test('FB4. agência de viagens: clona o modelo de viagens inteiro, nada falta, nível 1 em minutos', () => {
  const r = consultar({ nome: 'Agência Mundo', ramo: 'agência de viagens', whatsapp: '11988887777' }, cat);
  assert.equal(r.modelo.id, 'demo-viagens');
  assert.equal(r.modelo.clonavel, true);
  assert.deepEqual(r.faltam, []);
  assert.equal(r.nivel, 1);
  assert.ok(r.minutos > 0 && r.minutos <= 5);
  assert.ok(r.prontos.length >= 3, 'os módulos do modelo vêm prontos mesmo sem marcar');
});

test('FB5. sinônimo vira módulo pronto ("marcar horário" = agenda) e pedido desconhecido vira "falta" para o Cortex', () => {
  const r = consultar({ nome: 'Salão Bela', ramo: 'salão de beleza', whatsapp: '11977776666', precisa: ['marcar horário', 'programa de fidelidade'] }, cat);
  assert.ok(r.prontos.some(m => m.id === 'agenda'));
  assert.deepEqual(r.faltam.map(m => m.pedido), ['programa de fidelidade']);
  assert.equal(r.nivel, 2);
});

test('FB6. ficha inválida devolve erros e não sugere nada', () => {
  const r = consultar({ nome: '' }, cat);
  assert.ok(r.erros.length);
  assert.equal(r.modelo, null);
});

test('FB7. cada ramo comum cai no modelo clonável certo (13/11: barbearia, restaurante, loja, academia, profissional)', () => {
  const casos = { barbearia: 'demo-barbearia', pizzaria: 'demo-restaurante', 'loja de bolos': 'demo-loja', academia: 'demo-academia',
    dentista: 'demo-agenda', 'agência de viagens': 'demo-viagens', nutricionista: 'demo-profissional' };
  for (const [ramo, modelo] of Object.entries(casos)) {
    const r = consultar({ nome: 'Casa Teste', ramo, whatsapp: '81999999999' }, cat);
    assert.equal(r.modelo && r.modelo.id, modelo, ramo);
    assert.equal(r.modelo.clonavel, true, ramo);
  }
});
