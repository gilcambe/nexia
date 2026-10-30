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
  assert.match(s.erro, /^conserte o CI deste PR; não abra PR novo \(correção 1 de 2\)/);
  assert.match(s.erro, /erro X/);
  assert.deepEqual(cc.separarCi('só o pedido'), { pedido: 'só o pedido', erro: '' });
  assert.equal(cc.pedidoDoPr(pr().body), 'Mude `a/b.js`');
});

test('C10b. últimas 60 linhas do log, sem carimbo de hora nem cores', () => {
  const log = Array.from({ length: 200 }, (_, i) => `2026-10-19T10:00:00.1234567Z \x1b[31mlinha ${i}\x1b[0m`).join('\n');
  const u = cc.ultimasLinhas(log).split('\n');
  assert.equal(u.length, 60);
  assert.equal(u[0], 'linha 140');
  assert.equal(u[59], 'linha 199');
});

test('C10c. CI vermelho corrige 2 vezes, espera o commit novo e depois pede ajuda ou fecha se >24h', () => {
  const prRecente = pr('abc1234def', { body: 'Pedido: Mude `a/b.js` #10\n\nExecution: e1', created_at: new Date().toISOString() });
  assert.deepEqual(cc.decidirCorrecao({ pr: prRecente, checks: falhou, comentarios: [] }), { tipo: 'corrigir', rodada: 1 });
  const c1 = [{ body: `${cc.comentarioCi('abc1234def', 1)} tentando` }];
  assert.deepEqual(cc.decidirCorrecao({ pr: prRecente, checks: falhou, comentarios: c1 }), { tipo: 'esperar' }, 'mesmo commit: espera a correção chegar');
  assert.deepEqual(cc.decidirCorrecao({ pr: pr('fff0000aaa', { created_at: new Date().toISOString() }), checks: falhou, comentarios: c1 }), { tipo: 'corrigir', rodada: 2 });
  const c2 = [...c1, { body: cc.comentarioCi('fff0000aaa', 2) }];
  assert.deepEqual(cc.decidirCorrecao({ pr: pr('9990000bbb', { created_at: new Date().toISOString() }), checks: falhou, comentarios: c2 }), { tipo: 'ajuda' });
  assert.equal(cc.decidirCorrecao({ pr: pr('9990000bbb', { created_at: new Date().toISOString() }), checks: falhou, comentarios: [...c2, { body: '<!-- cortex-ajuda-ci -->' }] }), null, 'pede ajuda uma vez só');

  const prAntigo = pr('9990000bbb', { body: 'Pedido: Mude `a/b.js` #10\n\nExecution: e1', created_at: new Date(Date.now() - 25 * 3600e3).toISOString() });
  assert.deepEqual(cc.decidirCorrecao({ pr: prAntigo, checks: falhou, comentarios: c2 }), { tipo: 'fechar', issueNum: 10 }, 'PR vermelho há >24h após 2 tentativas é fechado');
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
