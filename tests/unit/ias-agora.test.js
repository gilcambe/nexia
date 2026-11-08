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

test('carregar busca vagas e issues e devolve formato iasAgora', async () => {
  const chamadas = [];
  const gh = async (path) => {
    chamadas.push(path);
    if (path.includes('/actions/secrets')) return { secrets: [{ name: 'IA_VAGA_1' }] };
    if (path.includes('/actions/variables')) return { value: JSON.stringify({ pausadas: [], ordem: [] }) };
    if (path.includes('ia-vagas-estado')) return [];
    if (path.includes('/pulls')) return [];
    if (path.includes('labels=jules-enviado')) return [];
    if (path.includes('labels=cortex-rodando')) {
      return [{ number: 99, title: 'ajuste header', updated_at: new Date().toISOString(), labels: [{ name: 'cortex-rodando' }] }];
    }
    return [];
  };

  const { carregar } = require('../../netlify/functions/central/ias-agora');
  const lista = await carregar(gh, { JULES_API_KEY: 'test-key' });
  assert.ok(Array.isArray(lista));
  const cortex = lista.find((x) => x.nome === 'Cortex');
  const jules = lista.find((x) => x.nome === 'Jules');
  assert.ok(cortex);
  assert.ok(jules);
  assert.strictEqual(cortex.situacao, 'ativa');
  assert.strictEqual(cortex.tarefa.numero, 99);
  assert.strictEqual(jules.situacao, 'ociosa');
  assert.strictEqual(jules.texto, 'Parado, sem tarefa');
  assert.ok(!JSON.stringify(lista).includes('test-key'));
});
