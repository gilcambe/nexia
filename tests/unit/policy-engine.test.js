'use strict';
// Fase 6: Policy Engine (spec §15 níveis de risco × §23 autonomia 0–5).
const test = require('node:test');
const assert = require('node:assert');
const { decide, matches } = require('../../nexia-ai/policy-engine');

const tool = (name, risk, min_autonomy) => ({ name, risk, ...(min_autonomy !== undefined ? { min_autonomy } : {}) });
const d = (t, autonomy, environment, rules) => decide({ tool: t, project: { autonomy_level: autonomy }, environment, policy: rules ? { rules } : null }).decision;

test('P1. matriz padrão: LOW auto; MEDIUM a partir da autonomia 1; HIGH a partir da 3; CRITICAL sempre confirma', () => {
  const read = tool('vault.get', 'LOW');
  const edit = tool('workspace.write_file', 'MEDIUM');
  const branch = tool('github.create_branch', 'MEDIUM', 2);
  const pr = tool('github.create_pr', 'HIGH');
  const push = tool('github.push', 'HIGH', 2);
  const prod = tool('deploy.production', 'CRITICAL');
  const rows = [0, 1, 2, 3, 4, 5].map(a => [a, d(read, a), d(edit, a), d(branch, a), d(push, a), d(pr, a), d(prod, a)]);
  assert.deepStrictEqual(rows, [
    [0, 'auto', 'confirm', 'confirm', 'confirm', 'confirm', 'confirm'],
    [1, 'auto', 'auto', 'confirm', 'confirm', 'confirm', 'confirm'],
    [2, 'auto', 'auto', 'auto', 'auto', 'confirm', 'confirm'],
    [3, 'auto', 'auto', 'auto', 'auto', 'auto', 'confirm'],
    [4, 'auto', 'auto', 'auto', 'auto', 'auto', 'confirm'],
    [5, 'auto', 'auto', 'auto', 'auto', 'auto', 'confirm'],
  ]);
});

test('P2. produção: acima de LOW sempre confirma, em qualquer autonomia; LOW continua automático', () => {
  assert.strictEqual(d(tool('github.get_checks', 'LOW'), 0, 'production'), 'auto');
  for (const r of ['MEDIUM', 'HIGH', 'CRITICAL']) assert.strictEqual(d(tool('x.y', r), 5, 'production'), 'confirm', r);
});

test('P3. ferramenta desconhecida ou sem risco declarado é proibida', () => {
  assert.strictEqual(decide({ tool: undefined, project: {} }).decision, 'forbidden');
  assert.strictEqual(decide({ tool: { name: 'x.y', risk: 'EXTREME' }, project: {} }).decision, 'forbidden');
  assert.strictEqual(d(tool('x.y', 'LOW'), undefined), 'auto', 'sem autonomia definida vale 0');
});

test('P4. política do projeto: forbidden e confirm endurecem; auto libera só até HIGH e fora de produção', () => {
  const checks = tool('github.get_checks', 'LOW');
  const pr = tool('github.create_pr', 'HIGH');
  const prod = tool('deploy.production', 'CRITICAL');
  assert.strictEqual(d(checks, 5, 'staging', [{ tool: 'github.*', decision: 'forbidden' }]), 'forbidden');
  assert.strictEqual(d(checks, 5, 'staging', [{ tool: 'github.get_checks', decision: 'confirm' }]), 'confirm');
  assert.strictEqual(d(pr, 0, 'staging', [{ tool: 'github.create_pr', decision: 'auto' }]), 'auto');
  assert.strictEqual(d(pr, 0, 'production', [{ tool: 'github.create_pr', decision: 'auto' }]), 'confirm');
  assert.strictEqual(d(prod, 5, 'staging', [{ tool: '*', decision: 'auto' }]), 'confirm');
  // forbidden em qualquer regra que case ganha da mais específica
  assert.strictEqual(d(pr, 5, 'staging', [{ tool: 'github.create_pr', decision: 'auto' }, { tool: '*', decision: 'forbidden' }]), 'forbidden');
  // a mais específica ganha: exata > curinga; com ambiente > sem
  assert.strictEqual(d(pr, 0, 'staging', [{ tool: 'github.*', decision: 'auto' }, { tool: 'github.create_pr', decision: 'confirm' }]), 'confirm');
  assert.strictEqual(d(pr, 0, 'staging', [{ tool: 'github.create_pr', decision: 'confirm' }, { tool: 'github.*', environment: 'staging', decision: 'auto' }]), 'auto');
  // regra de outro ambiente não se aplica
  assert.strictEqual(d(checks, 0, 'staging', [{ tool: 'github.*', environment: 'production', decision: 'forbidden' }]), 'auto');
});

test('P5. curingas: "*", prefixo.* e segmento.*', () => {
  assert.ok(matches('*', 'vault.get'));
  assert.ok(matches('vault.*', 'vault.get'));
  assert.ok(matches('github.*', 'github.actions.dispatch'));
  assert.ok(!matches('vault.*', 'github.get_repo'));
  assert.ok(!matches('vault.get', 'vault.get_all'));
  assert.ok(matches('*.get_repo', 'github.get_repo'));
});
