'use strict';
// #2873: aba "O que falta" da Central Kernex.
const test = require('node:test');
const assert = require('node:assert/strict');
const { montar, buscar, doNo } = require('../../netlify/functions/central/o-que-falta');

const L = (...n) => n.map((name) => ({ name }));
const agora = Date.parse('2026-11-02T15:00:00Z');

test('OQF1. pedido-mãe mostra X de Y partes prontas e urgente vem primeiro', () => {
  const abertas = [
    { number: 10, title: 'Pedido normal', labels: L('cortex-fila') },
    { number: 20, title: 'Épico urgente', labels: L('cortex-fila', 'cortex-dividido', 'cortex-urgente') },
    { number: 21, title: '[Parte 2/3 de #20] B', labels: L('cortex-fila', 'cortex-parte', 'cortex-rodando') },
    { number: 22, title: '[Parte 3/3 de #20] C', labels: L('cortex-fila', 'cortex-parte') },
  ];
  const r = montar({ abertas, agora });
  assert.equal(r.comCortex[0].numero, 20);
  assert.deepEqual(r.comCortex[0].partes, { prontas: 1, total: 3 });
  assert.equal(r.comCortex[0].rodando, true);
  assert.equal(r.comCortex[0].motivo, 'Fazendo agora');
  assert.equal(r.comCortex.length, 2, 'partes não viram linhas próprias');
  assert.equal(r.resumo.partesNaFila, 2);
  assert.equal(r.resumo.rodando, 1);
});

test('OQF2. PR da Claude e issue vez-do-dono aparecem em Esperando você', () => {
  const r = montar({
    abertas: [{ number: 5, title: 'Colar chave', labels: L('vez-do-dono') }],
    prs: [{ number: 7, title: 'X', head: { ref: 'claude/x' }, labels: [] }, { number: 8, title: 'Y', head: { ref: 'nexia/y' }, labels: [] }, { number: 9, title: 'Z', draft: true, head: { ref: 'claude/z' }, labels: [] }],
    agora,
  });
  assert.deepEqual(r.esperandoVoce.map((x) => x.numero), [7, 5]);
  assert.equal(r.comCortex.length, 0);
});

test('OQF3. pronto = fechado em 72 h; fechado como "não planejado" ou PR fechado sem merge fica fora', () => {
  const r = montar({
    fechadas: [
      { number: 1, title: 'ok', closed_at: '2026-11-02T10:00:00Z' },
      { number: 2, title: 'velho', closed_at: '2026-10-28T10:00:00Z' },
      { number: 3, title: 'desistiu', closed_at: '2026-11-02T10:00:00Z', state_reason: 'not_planned' },
      { number: 4, title: 'pr juntado', closed_at: '2026-11-02T11:00:00Z', pull_request: { merged_at: '2026-11-02T11:00:00Z' } },
      { number: 6, title: 'pr fechado', closed_at: '2026-11-02T11:00:00Z', pull_request: { merged_at: null } },
    ],
    agora,
  });
  assert.deepEqual(r.prontos.map((x) => x.numero), [4, 1]);
});

test('OQF4. fila pausada aparece no resumo', () => {
  assert.equal(montar({ abertas: [{ number: 1, title: 'a', labels: L('cortex-fila', 'fila-pausada') }], agora }).resumo.pausada, true);
});

test('OQF5. buscar pagina o GraphQL e converte os nós', async () => {
  const chamadas = [];
  const gql = async (q, depois) => {
    chamadas.push([q, depois]);
    if (/label:cortex-fila/.test(q)) return depois ? { pageInfo: { hasNextPage: false }, nodes: [{ number: 2, title: 'b', url: 'u2', labels: { nodes: [{ name: 'cortex-fila' }] } }] }
      : { pageInfo: { hasNextPage: true, endCursor: 'c1' }, nodes: [{ number: 1, title: 'a', url: 'u1', labels: { nodes: [{ name: 'cortex-urgente' }] } }] };
    if (/is:pr is:open/.test(q)) return { pageInfo: {}, nodes: [{ number: 9, title: 'pr', url: 'u9', headRefName: 'claude/a', isDraft: false, labels: { nodes: [] } }] };
    return { pageInfo: {}, nodes: [] };
  };
  const r = await buscar(gql, agora);
  assert.equal(r.comCortex.length, 2);
  assert.equal(r.comCortex[0].numero, 1);
  assert.equal(r.esperandoVoce[0].numero, 9);
  assert.ok(chamadas.some(([, d]) => d === 'c1'));
  assert.equal(doNo({ number: 1, headRefName: 'x', mergedAt: 'm', labels: { nodes: [] } }).pull_request.merged_at, 'm');
});
