'use strict';
// Fila do Cortex (#1017): fecha só rascunhos do Cortex parados há 3 dias e sem automerge (lista falsa, sem rede).
const test = require('node:test');
const assert = require('node:assert');
const { rascunhosParados, MSG_RASCUNHO_PARADO } = require('../../scripts/cortex-fila');

const AGORA = Date.parse('2026-10-19T12:00:00Z');
const H = 3600e3;
const BOT = { login: 'nexia-gilcambe-1709[bot]', type: 'Bot' };
const pr = (number, extra = {}) => ({ number, state: 'open', draft: true, title: 'NEXIA: tarefa', user: BOT, labels: [], created_at: new Date(AGORA - 100 * H).toISOString(), ...extra });

test('CFR1. só os rascunhos antigos do Cortex sem automerge são fechados', () => {
  const prs = [
    pr(1), // fecha
    pr(2, { draft: false }), // não é rascunho
    pr(3, { labels: [{ name: 'automerge' }] }), // tem automerge
    pr(4, { user: { login: 'gilcambe', type: 'User' } }), // outra pessoa
    pr(5, { title: 'Site: ajuste' }), // título não começa com NEXIA:
    pr(6), // commit recente
    pr(7, { created_at: new Date(AGORA - 10 * H).toISOString() }), // aberto há pouco
    pr(8), // sem data de commit conhecida
    pr(9, { user: { login: 'dependabot[bot]', type: 'Bot' } }), // outro app
  ];
  const velho = new Date(AGORA - 80 * H).toISOString();
  const commitEm = { 1: velho, 2: velho, 3: velho, 4: velho, 5: velho, 6: new Date(AGORA - 5 * H).toISOString(), 7: velho, 9: velho };
  assert.deepStrictEqual(rascunhosParados({ prs, commitEm, agora: AGORA }), [1]);
});

test('CFR2. no máximo 10 por ciclo e a mensagem explica que nada foi apagado', () => {
  const prs = Array.from({ length: 15 }, (_, k) => pr(k + 1));
  const commitEm = Object.fromEntries(prs.map(p => [p.number, new Date(AGORA - 73 * H).toISOString()]));
  assert.equal(rascunhosParados({ prs, commitEm, agora: AGORA }).length, 10);
  assert.match(MSG_RASCUNHO_PARADO, /parado há 3 dias/);
  assert.match(MSG_RASCUNHO_PARADO, /continua na fila do Cortex/);
});
