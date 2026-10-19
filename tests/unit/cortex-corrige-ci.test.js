'use strict';
// #828 (Melhoria C10): CI do PR do Cortex falhou → o Cortex recebe as últimas 80 linhas do erro e tenta de novo (até 2x).
const test = require('node:test');
const assert = require('node:assert/strict');
const cc = require('../../nexia-ai/orchestrator/correcao-ci');

const pr = (sha = 'abc1234def', extra = {}) => ({ number: 7, state: 'open', head: { ref: 'nexia/tela-x-1a2b3c', sha }, body: 'Pedido: Mude `a/b.js`\n\nExecution: e1', ...extra });
const falhou = [{ name: cc.CHECK_CI, status: 'completed', conclusion: 'failure', id: 9 }];

test('C10a. pedido + marca + erro: o Orchestrator separa (branch e PR continuam os mesmos)', () => {
  const t = `Mude \`a/b.js\`${cc.MARCA}${cc.feedbackCi('erro X', 1)}`;
  const s = cc.separarCi(t);
  assert.equal(s.pedido, 'Mude `a/b.js`');
  assert.match(s.erro, /^O CI do PR falhou \(correção 1 de 2\)/);
  assert.match(s.erro, /erro X/);
  assert.deepEqual(cc.separarCi('só o pedido'), { pedido: 'só o pedido', erro: '' });
  assert.equal(cc.pedidoDoPr(pr().body), 'Mude `a/b.js`');
});

test('C10b. últimas 80 linhas do log, sem carimbo de hora nem cores', () => {
  const log = Array.from({ length: 200 }, (_, i) => `2026-10-19T10:00:00.1234567Z \x1b[31mlinha ${i}\x1b[0m`).join('\n');
  const u = cc.ultimasLinhas(log).split('\n');
  assert.equal(u.length, 80);
  assert.equal(u[0], 'linha 120');
  assert.equal(u[79], 'linha 199');
});

test('C10c. CI vermelho corrige 2 vezes, espera o commit novo e depois pede ajuda', () => {
  assert.deepEqual(cc.decidirCorrecao({ pr: pr(), checks: falhou, comentarios: [] }), { tipo: 'corrigir', rodada: 1 });
  const c1 = [{ body: `${cc.comentarioCi('abc1234def', 1)} tentando` }];
  assert.deepEqual(cc.decidirCorrecao({ pr: pr(), checks: falhou, comentarios: c1 }), { tipo: 'esperar' }, 'mesmo commit: espera a correção chegar');
  assert.deepEqual(cc.decidirCorrecao({ pr: pr('fff0000aaa'), checks: falhou, comentarios: c1 }), { tipo: 'corrigir', rodada: 2 });
  const c2 = [...c1, { body: cc.comentarioCi('fff0000aaa', 2) }];
  assert.deepEqual(cc.decidirCorrecao({ pr: pr('9990000bbb'), checks: falhou, comentarios: c2 }), { tipo: 'ajuda' });
  assert.equal(cc.decidirCorrecao({ pr: pr('9990000bbb'), checks: falhou, comentarios: [...c2, { body: '<!-- cortex-ajuda-ci -->' }] }), null, 'pede ajuda uma vez só');
});

test('C10d. CI verde, ainda rodando ou PR que não é do Cortex: nada a fazer', () => {
  assert.equal(cc.decidirCorrecao({ pr: pr(), checks: [{ ...falhou[0], conclusion: 'success' }], comentarios: [] }), null);
  assert.equal(cc.decidirCorrecao({ pr: pr(), checks: [...falhou, { name: cc.CHECK_CI, status: 'in_progress' }], comentarios: [] }), null);
  assert.equal(cc.decidirCorrecao({ pr: pr('a', { head: { ref: 'feature/x', sha: 'a' } }), checks: falhou, comentarios: [] }), null);
});

test('C10e. a fila liga a correção e o Orchestrator usa o erro como 1ª rodada', () => {
  const fs = require('fs');
  const path = require('path');
  const fila = fs.readFileSync(path.join(__dirname, '../../scripts/cortex-fila.js'), 'utf8');
  assert.match(fila, /corrigirCiDosPrs\(token, runs\)/);
  assert.match(fila, /CORTEX_CORRIGIR_CI === '0'/);
  const orq = fs.readFileSync(path.join(__dirname, '../../nexia-ai/orchestrator/index.js'), 'utf8');
  assert.match(orq, /separarCi\(req\.message\)/);
  assert.match(orq, /RODADA DE CORREÇÃO DO CI/);
});
