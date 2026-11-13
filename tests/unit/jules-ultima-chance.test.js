'use strict';
// #3258: tarefa parada em "precisa de você" ganha UMA última chance no Jules quando ele tem cota.
const test = require('node:test');
const assert = require('node:assert');
const { ultimaChance, MAX_ENVIOS } = require('../../cloudflare/jules-auto.js');

const nomes = (i) => (i.labels || []).map(l => l.name || l);
const AGORA = Date.UTC(2026, 10, 13, 12, 0);
const iss = (number, labels = [], extra = {}) => ({ number, labels, created_at: new Date(AGORA - number * 36e5).toISOString(), updated_at: new Date(AGORA - 2 * 36e5).toISOString(), title: 't', body: 'b', ...extra });

test('UC1. escolhe a mais antiga primeiro e nunca passa das vagas', () => {
  const precisa = [iss(10, ['precisa-de-voce']), iss(30, ['precisa-de-voce']), iss(20, ['precisa-de-voce']), iss(40, ['precisa-de-voce'])];
  const r = ultimaChance(precisa, [], [], AGORA, nomes, 2);
  assert.deepEqual(r.mandar, [40, 30]); // número maior = criada antes neste teste
  assert.equal(ultimaChance(precisa, [], [], AGORA, nomes, MAX_ENVIOS).mandar.length, MAX_ENVIOS);
  assert.deepEqual(ultimaChance(precisa, [], [], AGORA, nomes, 0).mandar, []);
});

test('UC2. pula workflow, so-humano, vez-do-dono, já com última chance e com PR aberto', () => {
  const precisa = [
    iss(1, ['precisa-de-voce'], { body: 'mexer em .github/workflows/ci.yml' }),
    iss(2, ['precisa-de-voce', 'so-humano']), iss(3, ['precisa-de-voce', 'vez-do-dono']),
    iss(4, ['precisa-de-voce', 'jules-ultima-chance']), iss(5, ['precisa-de-voce']), iss(6, ['precisa-de-voce']),
  ];
  const r = ultimaChance(precisa, [], [{ title: 'fix', body: 'Closes #5' }], AGORA, nomes, 3);
  assert.deepEqual(r.mandar, [6]);
});

test('UC3. sem PR em 1 h volta para precisa-de-voce; com PR ou recente, não', () => {
  const chance = [
    iss(7, ['jules-ultima-chance']),
    iss(8, ['jules-ultima-chance'], { updated_at: new Date(AGORA - 10 * 6e4).toISOString() }),
    iss(9, ['jules-ultima-chance']),
    iss(11, ['jules-ultima-chance', 'precisa-de-voce']),
  ];
  const r = ultimaChance([], chance, [{ title: 'x #9', body: '' }], AGORA, nomes, 3);
  assert.deepEqual(r.devolver, [7]);
});
