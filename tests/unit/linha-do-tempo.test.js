'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { montarLinha } = require('../../netlify/functions/central/linha-do-tempo');

test('linha do tempo: entrou, Cortex pegou, PR, concluída, agora', () => {
  const issue = { number: 9, state: 'closed', created_at: '2026-11-08T10:00:00Z', updated_at: '2026-11-08T12:00:00Z', labels: [{ name: 'cortex-feito' }] };
  const eventos = [
    { event: 'closed', created_at: '2026-11-08T12:00:00Z' },
    { event: 'labeled', label: { name: 'cortex-rodando' }, created_at: '2026-11-08T10:05:00Z' },
    { event: 'labeled', label: { name: 'pista-3' }, created_at: '2026-11-08T10:05:00Z' },
    { event: 'labeled', label: { name: 'tentativa-2' }, created_at: '2026-11-08T10:30:00Z' },
    { event: 'cross-referenced', created_at: '2026-11-08T11:00:00Z', source: { issue: { number: 77, html_url: 'https://x/77', pull_request: {} } } },
  ];
  const l = montarLinha(issue, eventos, [], Date.parse('2026-11-08T13:00:00Z'));
  assert.deepStrictEqual(l.map((x) => x.texto), ['Entrou na fila', 'O Cortex pegou a tarefa', 'Tentativa 2', 'Abriu o PR #77', 'Concluída', 'Agora: Concluída']);
  assert.strictEqual(l[3].link, 'https://x/77');
});

test('linha do tempo: PR juntado entra com link', () => {
  const issue = { number: 1, state: 'open', created_at: '2026-11-08T10:00:00Z', updated_at: '2026-11-08T10:00:00Z', labels: [] };
  const l = montarLinha(issue, [], [{ estado: 'juntado', numero: 5, link: 'https://x/5', quando: '2026-11-08T11:00:00Z' }], Date.parse('2026-11-08T10:10:00Z'));
  assert.ok(l.some((x) => x.texto === 'PR #5 juntado' && x.link === 'https://x/5'));
  assert.strictEqual(l[l.length - 1].texto, 'Agora: Na fila');
});
