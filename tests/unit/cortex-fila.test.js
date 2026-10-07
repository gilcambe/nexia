'use strict';
// Fila fixa do Cortex: decisões puras (sem rede).
const test = require('node:test');
const assert = require('node:assert');
const { decidir, MAX_TENTATIVAS } = require('../../scripts/cortex-fila');

const AGORA = Date.parse('2026-10-07T10:00:00Z');
const issue = (n, labels = [], extra = {}) => ({ number: n, body: `tarefa ${n}`, author_association: 'OWNER', updated_at: '2026-10-07T09:59:00Z', labels: ['cortex-fila', ...labels].map(name => ({ name })), ...extra });
const run = (n, status, conclusion, minAtras = 1, id = n * 10) => ({ id, name: `Cortex #${n}`, status, conclusion, updated_at: new Date(AGORA - minAtras * 60000).toISOString() });

test('CF1. despacha em até 3 pistas, cada uma com o seu número', () => {
  const a = decidir({ issues: [1, 2, 3, 4].map(n => issue(n)), runs: [], agora: AGORA });
  assert.deepEqual(a.map(x => [x.tipo, x.numero, x.pista]), [['despachar', 1, 1], ['despachar', 2, 2], ['despachar', 3, 3]]);
});

test('CF2. ignora Issue de quem não é dono/membro/colaborador e pull requests', () => {
  const a = decidir({ issues: [issue(1, [], { author_association: 'NONE' }), issue(2, [], { pull_request: {} })], runs: [], agora: AGORA });
  assert.deepEqual(a, []);
});

test('CF3. execução com sucesso conclui; falha reenfileira com tentativa+1', () => {
  const a = decidir({ issues: [issue(1, ['cortex-rodando', 'pista-1']), issue(2, ['cortex-rodando', 'pista-2', 'tentativa-2'])], runs: [run(1, 'completed', 'success'), run(2, 'completed', 'failure')], agora: AGORA });
  assert.equal(a[0].tipo, 'concluir');
  assert.deepEqual([a[1].tipo, a[1].tentativa], ['reenfileirar', 3]);
});

test('CF4. na última tentativa trava e avisa', () => {
  const a = decidir({ issues: [issue(1, ['cortex-rodando', `tentativa-${MAX_TENTATIVAS - 1}`])], runs: [run(1, 'completed', 'failure')], agora: AGORA });
  assert.equal(a[0].tipo, 'travar');
});

test('CF5. respeita a espera crescente entre tentativas e as pistas ocupadas', () => {
  const issues = [issue(1, ['tentativa-2']), issue(2, ['cortex-rodando', 'pista-1']), issue(3)];
  const cedo = decidir({ issues, runs: [run(1, 'completed', 'failure', 10), run(2, 'in_progress', null)], agora: AGORA });
  assert.deepEqual(cedo.map(x => [x.numero, x.pista]), [[3, 2]]);
  const tarde = decidir({ issues, runs: [run(1, 'completed', 'failure', 31), run(2, 'in_progress', null)], agora: AGORA });
  assert.deepEqual(tarde.map(x => [x.numero, x.pista]), [[1, 2], [3, 3]]);
});

test('CF6. "rodando" sem execução por mais de 20 minutos volta para a fila', () => {
  const a = decidir({ issues: [issue(1, ['cortex-rodando'], { updated_at: '2026-10-07T09:30:00Z' })], runs: [], agora: AGORA });
  assert.equal(a[0].tipo, 'reenfileirar');
});

test('CF-cota. falha por cota do banco não gasta tentativa e pausa até 07:05 UTC', () => {
  const r = { ...run(1, 'completed', 'failure', 5), cota: true };
  const a = decidir({ issues: [issue(1, ['cortex-rodando', 'pista-1', 'tentativa-2']), issue(2)], runs: [r], agora: AGORA });
  assert.deepEqual([a[0].tipo, a[0].tentativa], ['reenfileirar', 2]);
  assert.equal(a.some(x => x.tipo === 'despachar'), false);
  const depois = decidir({ issues: [issue(2)], runs: [r], agora: Date.parse('2026-10-08T07:06:00Z') });
  assert.equal(depois[0].tipo, 'despachar');
});

test('CF-teste-final. fila vazia depois de entregas sem teste novo dispara o teste de pessoa', () => {
  const { precisaTesteFinal } = require('../../scripts/cortex-fila');
  assert.strictEqual(precisaTesteFinal({ abertas: 1, feitoEm: '2026-10-07T10:00:00Z', testeEm: null }), false, 'ainda há tarefas');
  assert.strictEqual(precisaTesteFinal({ abertas: 0, feitoEm: null, testeEm: null }), false, 'nada foi entregue');
  assert.strictEqual(precisaTesteFinal({ abertas: 0, feitoEm: '2026-10-07T10:00:00Z', testeEm: null }), true);
  assert.strictEqual(precisaTesteFinal({ abertas: 0, feitoEm: '2026-10-07T10:00:00Z', testeEm: '2026-10-07T09:00:00Z' }), true, 'teste é anterior à entrega');
  assert.strictEqual(precisaTesteFinal({ abertas: 0, feitoEm: '2026-10-07T10:00:00Z', testeEm: '2026-10-07T11:00:00Z' }), false, 'já testado');
});
