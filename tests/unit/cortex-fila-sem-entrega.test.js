'use strict';
// Fila do Cortex: rodada verde sem entrega não pode reabrir rascunho para sempre (loop do gitleaks, 19/10).
const test = require('node:test');
const assert = require('node:assert');
const { depoisSemEntrega, MAX_SEM_ENTREGA } = require('../../scripts/cortex-fila');

test('CFS1. primeira rodada sem entrega volta para a fila e conta 1', () => {
  assert.deepStrictEqual(depoisSemEntrega(['cortex-fila', 'tentativa-6']), { n: 1, travar: false });
});

test('CFS2. ao chegar no limite, trava (não abre mais rascunhos)', () => {
  const ls = ['cortex-fila', `sem-entrega-${MAX_SEM_ENTREGA - 1}`];
  assert.deepStrictEqual(depoisSemEntrega(ls), { n: MAX_SEM_ENTREGA, travar: true });
});

test('CFS3. usa o maior contador mesmo com rótulos velhos misturados', () => {
  assert.strictEqual(depoisSemEntrega(['sem-entrega-5', 'sem-entrega-1']).n, 6);
});

test('SE-LACO. validação de entrega que falha conta como rodada sem entrega (nunca repete para sempre)', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '../../scripts/cortex-fila.js'), 'utf8');
  const i = src.indexOf('const val = await validarCortexFeito(token, { number: n, body: acao.corpo });');
  const trecho = src.slice(i, src.indexOf('const revisao', i));
  assert.ok(i > 0 && /depoisSemEntrega\(ls\)/.test(trecho) && /L\.travado/.test(trecho), 'o caminho da validação falha precisa contar e travar');
});
