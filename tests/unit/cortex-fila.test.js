'use strict';
// Fila fixa do Cortex: decisões puras (sem rede).
const test = require('node:test');
const assert = require('node:assert');
const { decidir, MAX_TENTATIVAS, precisaDividir, paisConcluidos, dividirComIA } = require('../../scripts/cortex-fila');

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

test('CF5. tarefa que falhou é despachada na hora (sem espera de horário), respeitando pistas', () => {
  const issues = [issue(1, ['tentativa-2']), issue(2, ['cortex-rodando', 'pista-1']), issue(3)];
  const a = decidir({ issues, runs: [run(1, 'completed', 'failure', 1), run(2, 'in_progress', null)], agora: AGORA });
  assert.deepEqual(a.map(x => [x.numero, x.pista]), [[1, 2], [3, 3]]);
});

test('CF6. "rodando" sem execução por mais de 20 minutos volta para a fila', () => {
  const a = decidir({ issues: [issue(1, ['cortex-rodando'], { updated_at: '2026-10-07T09:30:00Z' })], runs: [], agora: AGORA });
  assert.equal(a[0].tipo, 'reenfileirar');
});

test('CF-cota. falha por cota do banco não gasta tentativa e a fila NÃO pausa por horário', () => {
  const r = { ...run(1, 'completed', 'failure', 5), cota: true };
  const a = decidir({ issues: [issue(1, ['cortex-rodando', 'pista-1', 'tentativa-2']), issue(2)], runs: [r], agora: AGORA });
  assert.deepEqual([a[0].tipo, a[0].tentativa], ['reenfileirar', 2]);
  assert.equal(a.some(x => x.tipo === 'despachar' && x.numero === 2), true);
});

test('CF-teste-final. fila vazia depois de entregas sem teste novo dispara o teste de pessoa', () => {
  const { precisaTesteFinal } = require('../../scripts/cortex-fila');
  assert.strictEqual(precisaTesteFinal({ abertas: 1, feitoEm: '2026-10-07T10:00:00Z', testeEm: null }), false, 'ainda há tarefas');
  assert.strictEqual(precisaTesteFinal({ abertas: 0, feitoEm: null, testeEm: null }), false, 'nada foi entregue');
  assert.strictEqual(precisaTesteFinal({ abertas: 0, feitoEm: '2026-10-07T10:00:00Z', testeEm: null }), true);
  assert.strictEqual(precisaTesteFinal({ abertas: 0, feitoEm: '2026-10-07T10:00:00Z', testeEm: '2026-10-07T09:00:00Z' }), true, 'teste é anterior à entrega');
  assert.strictEqual(precisaTesteFinal({ abertas: 0, feitoEm: '2026-10-07T10:00:00Z', testeEm: '2026-10-07T11:00:00Z' }), false, 'já testado');
});

test('CF-D1. tarefa grande é dividida (não despachada); pequena segue; parte e já dividida nunca se dividem de novo', () => {
  const grande = issue(1, [], { body: 'x'.repeat(2600) });
  const muitosArquivos = issue(2, [], { body: 'Edite a.js, b.js, c.js, d.js e e.js' });
  const pequena = issue(3, []);
  const parte = issue(4, ['cortex-parte'], { body: 'y'.repeat(2600) });
  const a = decidir({ issues: [grande, muitosArquivos, pequena, parte], runs: [], agora: AGORA });
  assert.deepEqual(a.map(x => [x.tipo, x.numero]), [['dividir', 1], ['dividir', 2], ['despachar', 3], ['despachar', 4]]);
  assert.equal(precisaDividir(issue(5, ['cortex-sem-divisao'], { body: 'z'.repeat(3000) })), false);
  assert.equal(decidir({ issues: [issue(6, ['cortex-dividido'])], runs: [], agora: AGORA }).length, 0, 'pai dividido não é despachado');
});

test('CF-D2. pai é concluído só quando todas as partes estão feitas', () => {
  const pais = [{ number: 10, labels: ['cortex-dividido'] }];
  const parte = (k, estado, feito) => ({ title: `[Parte ${k}/2 de #10] x`, state: estado, labels: feito ? ['cortex-parte', 'cortex-feito'] : ['cortex-parte'] });
  assert.deepEqual(paisConcluidos({ pais, partes: [parte(1, 'closed', true), parte(2, 'open', false)] }), []);
  assert.deepEqual(paisConcluidos({ pais, partes: [parte(1, 'closed', true), parte(2, 'closed', true)] }), [10]);
  assert.deepEqual(paisConcluidos({ pais, partes: [] }), []);
});

test('CF-D3. divisor aceita só 2 a 5 partes completas e tenta o próximo modelo', async () => {
  const resp = textos => ({ capabilities: () => ({ available: true }), chat: async () => ({ text: textos }) });
  const boa = JSON.stringify(['Parte um com texto bem completo do arquivo a.js', 'Parte dois com texto bem completo do arquivo b.js']);
  assert.equal(await dividirComIA('t', resp('sem json'), [{}]), null);
  assert.equal(await dividirComIA('t', resp('["curta"]'), [{}]), null);
  const r = { capabilities: d => ({ available: d.ok }), chat: async () => ({ text: boa }) };
  assert.equal((await dividirComIA('t', r, [{ ok: false }, { ok: true }])).length, 2);
});
