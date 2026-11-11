'use strict';
// Regressão de 11/11/2026: o Worker (versão antiga) gravava 7 etapas e o executor (versão nova) montava 6.
// O laço lia plan[i].action com índices desalinhados -> ORCHESTRATOR_ERROR "Cannot read properties of undefined (reading 'action')".
const test = require('node:test');
const assert = require('node:assert/strict');
const { alinharPlano, planFor } = require('../../nexia-ai/orchestrator/index.js');

const msg = 'Corrija o texto do botão em src/pages/central/Painel.tsx';
const velho = ['agent:analyze', 'create_branch', 'agent:implement', 'agent:review', 'agent:security', 'create_pr', 'checks']
  .map((action, k) => ({ agent: ['architect', 'coder', 'frontend', 'reviewer', 'security', 'devops', 'qa'][k], goal: 'x', status: 'pending' }));

test('PV1. nada começou: adota o plano novo inteiro (sem índice desalinhado)', () => {
  const novo = planFor('change', msg);
  const r = alinharPlano({ status: 'planned' }, novo, velho.map(s => ({ ...s })));
  assert.equal(r.steps.length, r.plan.length);
  assert.deepEqual(r.steps.map(s => s.agent), novo.map(p => p.agent));
  assert.ok(r.steps.every(s => !('action' in s)), 'etapas gravadas nunca levam action (o cofre recusa)');
  for (let i = 0; i < r.plan.length; i++) assert.ok(r.plan[i] && r.plan[i].action, 'plan[' + i + '].action definido');
});

test('PV2. já começou: segue o plano gravado, e plan e steps ficam do mesmo tamanho', () => {
  const novo = planFor('change', msg);
  const andamento = velho.map((s, k) => ({ ...s, status: k === 0 ? 'done' : 'pending' }));
  const r = alinharPlano({ status: 'running' }, novo, andamento, planFor('change', msg, { comArchitect: true }));
  assert.equal(r.plan.length, 7); assert.equal(r.steps.length, 7);
  assert.equal(r.plan[0].action, 'agent:analyze');
});

test('PV3. mesma versão: nada muda', () => {
  const novo = planFor('change', msg);
  const r = alinharPlano({ status: 'running' }, novo, novo.map(p => ({ ...p, status: 'pending' })));
  assert.equal(r.plan, novo);
});

test('PV4. etapas do plano novo passam no formato do cofre (step obrigatório, sem action)', () => {
  const schemas = require('../../nexia-ai/vault/schemas.js');
  const { validateEntity } = require('../../nexia-ai/vault/validate.js');
  const S = (schemas.SCHEMAS || schemas).Execution || (schemas.schemas || {}).Execution;
  assert.ok(S, 'schema Execution encontrado');
  const novo = planFor('change', msg);
  const r = alinharPlano({ status: 'planned' }, novo, velho.map(s => ({ ...s })));
  r.steps.forEach((s, k) => assert.equal(s.step, k + 1));
  const res = validateEntity(S, { plan: r.steps }, { partial: true });
  const erros = res && (res.errors || res.erros || (res.ok === false ? res : null));
  assert.ok(!erros || (Array.isArray(erros) && erros.length === 0), 'cofre recusou: ' + JSON.stringify(erros));
});
