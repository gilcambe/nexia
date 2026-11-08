'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { iasAgora } = require('../../netlify/functions/central/ias-agora');

test('ias agora: ativa, ociosa, sem cota e erro', () => {
  const agora = Date.parse('2026-11-08T12:00:00Z');
  const abertas = [{ number: 123, title: 'corrigir botão', updated_at: '2026-11-08T11:48:00Z', labels: [{ name: 'cortex-rodando' }] }];
  const vagas = [
    { vaga: 1, ligada: true, provedor: 'groq', teste: { situacao: 'ok' }, usos: [] },
    { vaga: 2, ligada: true, provedor: 'gemini', teste: { situacao: 'sem-cota' }, usos: [] },
    { vaga: 3, ligada: true, provedor: 'mistral', teste: { situacao: 'recusada' }, usos: [] },
    { vaga: 4, ligada: false },
  ];
  const r = iasAgora({ vagas, julesEstado: { ligado: true }, abertas, agora });
  const por = Object.fromEntries(r.map((x) => [x.nome, x]));
  assert.strictEqual(por.Cortex.situacao, 'ativa');
  assert.strictEqual(por.Cortex.ativa, true);
  assert.strictEqual(por.Cortex.texto, 'Trabalhando no #123 há 12 min');
  assert.strictEqual(por.Cortex.tarefa.numero, 123);
  assert.strictEqual(por.Jules.situacao, 'ociosa');
  assert.strictEqual(por['Vaga 1 · groq'].situacao, 'ociosa');
  assert.strictEqual(por['Vaga 2 · gemini'].situacao, 'sem-cota');
  assert.strictEqual(por['Vaga 3 · mistral'].situacao, 'erro');
  assert.ok(!r.some((x) => x.nome.startsWith('Vaga 4')));
  assert.ok(!JSON.stringify(r).includes('IA_VAGA'));
});
