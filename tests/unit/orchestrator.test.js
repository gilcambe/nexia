'use strict';
// Fase 10: partes determinísticas do Orchestrator (intenção, plano, gates, orçamento, agentes).
const test = require('node:test');
const assert = require('node:assert');
const { classifyIntent, planFor, specialistFor } = require('../../nexia-ai/orchestrator');
const { evaluateGates, verdict } = require('../../nexia-ai/orchestrator/gates');
const { createMeter } = require('../../nexia-ai/orchestrator/runtime');
const { AGENTS, allowed } = require('../../nexia-ai/orchestrator/agents');
const { candidates } = require('../../nexia-ai/orchestrator/models');
const { AGENT_IDS } = require('../../nexia-ai/vault/schemas');

const ok = n => ({ name: n, status: 'completed', conclusion: 'success' });

test('U1. intenção por regras (spec §29) e especialista pelo assunto', () => {
  const cases = [
    ['Corrija o botão de enviar do formulário', 'change'], ['Adicione um campo de telefone', 'change'],
    ['Mostre o status do projeto', 'status'], ['O que mudou desde o último deploy?', 'status'],
    ['Crie o pipeline de CI/CD', 'pipeline'], ['Publique em staging', 'deploy_staging'],
    ['Publique em produção', 'deploy_production'], ['Como funciona o login?', 'question'],
  ];
  for (const [m, want] of cases) assert.strictEqual(classifyIntent(m), want, m);
  assert.deepStrictEqual(['Mude a cor do botão', 'Crie um índice no Firestore', 'Ajuste o webhook da API', 'Corrija o cálculo'].map(specialistFor),
    ['frontend', 'database', 'backend', 'coder']);
  assert.deepStrictEqual(planFor('change', 'botão').map(s => s.action),
    ['agent:analyze', 'create_branch', 'agent:implement', 'agent:review', 'agent:security', 'create_pr', 'checks']);
  assert.deepStrictEqual(planFor('deploy_production', 'x').map(s => s.action), ['checks_before_deploy', 'deploy_production', 'sync_deploy']);
});

test('U2. gates: sem evidência fica pending; check falho reprova; obrigatório sem check nunca passa', () => {
  const all = [ok('Lint'), ok('Typecheck'), ok('Unit tests'), ok('Build'), ok('gitleaks')];
  const base = { review: { verdict: 'approve' } };
  assert.strictEqual(verdict(evaluateGates({ ...base, checks: null })), 'pending');
  assert.strictEqual(verdict(evaluateGates({ ...base, checks: [] })), 'pending', 'sem checks: testes e build obrigatórios pendentes');
  assert.strictEqual(verdict(evaluateGates({ ...base, checks: all })), 'passed');
  assert.strictEqual(verdict(evaluateGates({ ...base, checks: [...all.slice(0, 4), { name: 'gitleaks', status: 'completed', conclusion: 'failure' }] })), 'failed');
  assert.strictEqual(verdict(evaluateGates({ ...base, checks: [...all.slice(0, 2), { name: 'Unit tests', status: 'in_progress', conclusion: null }, ...all.slice(3)] })), 'pending');
  const noSec = all.slice(0, 4);
  assert.strictEqual(verdict(evaluateGates({ ...base, checks: noSec })), 'pending', 'gate 6 sem check nem Security Agent');
  assert.strictEqual(verdict(evaluateGates({ ...base, checks: noSec, security: { verdict: 'approve' } })), 'passed');
  assert.strictEqual(verdict(evaluateGates({ ...base, checks: all, security: { verdict: 'changes_requested' } })), 'failed');
  assert.strictEqual(verdict(evaluateGates({ checks: all, review: null })), 'pending', 'gate 8 sem revisão');
  assert.strictEqual(verdict(evaluateGates({ ...base, checks: all, wantsStaging: true })), 'pending');
  assert.strictEqual(verdict(evaluateGates({ ...base, checks: all, wantsStaging: true, deployment: { id: 'd', status: 'succeeded' } })), 'passed');
  assert.strictEqual(verdict(evaluateGates({ ...base, checks: all, wantsStaging: true, deployment: { id: 'd', status: 'failed' } })), 'failed');
  assert.strictEqual(verdict(evaluateGates({ ...base, checks: all, wantsProduction: true })), 'pending', 'produção nunca passa sozinha');
  const prod = (d) => evaluateGates({ ...base, checks: all, wantsStaging: true, wantsProduction: true, deployment: d });
  const user = { type: 'user', id: 'gilcambe' };
  assert.strictEqual(verdict(prod({ id: 'd', status: 'pending', approved_by: user })), 'pending');
  assert.strictEqual(verdict(prod({ id: 'd', status: 'succeeded', approved_by: user })), 'passed');
  assert.match(prod({ id: 'd', status: 'succeeded', approved_by: user })[10].evidence, /aprovado por gilcambe/);
  assert.strictEqual(verdict(prod({ id: 'd', status: 'succeeded', approved_by: { type: 'agent', id: 'devops' } })), 'failed', 'gate 11 exige pessoa');
  assert.strictEqual(verdict(prod({ id: 'd', status: 'succeeded' })), 'failed');
  assert.strictEqual(verdict(prod({ id: 'd', status: 'failed', approved_by: user })), 'failed');
  assert.strictEqual(evaluateGates({ checks: [] }).length, 11);
  // Fase 11: mapa check→gate do projeto (nome exato; gate mapeado vira obrigatório)
  const map = [{ gate: 3, check: 'ci / unit' }, { gate: 7, check: 'ci / e2e' }];
  const named = [ok('ci / unit'), ok('Build'), ok('gitleaks'), ok('Unit tests (legado)')];
  const g = evaluateGates({ ...base, checks: named, checkMap: map });
  assert.deepStrictEqual([g[2].status, g[2].evidence, g[6].status], ['passed', 'check: ci / unit', 'pending'], 'E2E mapeado e ausente fica pendente');
  assert.match(g[6].evidence, /check mapeado ausente: ci \/ e2e/);
  assert.strictEqual(verdict(evaluateGates({ ...base, checks: [...named, { name: 'ci / e2e', status: 'completed', conclusion: 'failure' }], checkMap: map })), 'failed');
  assert.strictEqual(evaluateGates({ ...base, checks: [ok('Unit tests'), ok('Build'), ok('gitleaks')], checkMap: [{ gate: 3, check: 'ci / unit' }] })[2].status, 'pending', 'com mapa, nome parecido não conta');
});

test('U3. orçamento: passos, ferramentas, tokens e tempo', () => {
  let t = 0;
  const m = createMeter({ max_steps: 2, max_tool_calls: 1, max_tokens: 100, max_ms: 1000 }, () => t);
  m.check();
  m.usage.steps = 2;
  assert.throws(() => m.check(), e => e.code === 'BUDGET_EXCEEDED');
  m.usage.steps = 0; m.usage.tool_calls = 1;
  assert.throws(() => m.check(), /chamadas de ferramenta/);
  m.usage.tool_calls = 0; m.usage.input_tokens = 100;
  assert.throws(() => m.check(), /tokens/);
  m.usage.input_tokens = 0; t = 1000;
  assert.throws(() => m.check(), /tempo/);
});

test('U4. agentes: os 10 da spec, só leitura onde deve, modelos por classe', () => {
  assert.deepStrictEqual(Object.keys(AGENTS).sort(), [...AGENT_IDS].sort());
  for (const a of ['architect', 'reviewer', 'security']) {
    assert.ok(allowed(a, 'github.get_file') && !allowed(a, 'github.commit_files') && !allowed(a, 'github.create_pr'), a);
  }
  for (const a of ['coder', 'frontend', 'backend', 'database']) assert.ok(allowed(a, 'github.commit_files') && !allowed(a, 'github.create_pr') && !allowed(a, 'deploy.staging'), a);
  assert.ok(allowed('devops', 'deploy.staging') && !allowed('devops', 'github.commit_files'));
  for (const a of Object.keys(AGENTS)) assert.ok(!allowed(a, 'deploy.production') && !allowed(a, 'local.terminal_run'), a);
  const router = { capabilities: d => ({ available: d.model !== 'claude-opus-5-5', tool_call: true }) };
  assert.deepStrictEqual(candidates(router, 'reasoning', {}).map(d => d.model).slice(0, 2), ['claude-sonnet-5-5', 'openai/gpt-oss-120b'], 'sem o primeiro, cai no próximo');
  // ADR-FREE-03: sem chave da Anthropic (paga), só os grátis que estiverem configurados
  const free = { capabilities: d => ({ available: ['google', 'groq'].includes(d.provider), tool_call: true }) };
  assert.deepStrictEqual(candidates(free, 'coding', {}).map(d => `${d.provider}:${d.model}`), ['groq:openai/gpt-oss-120b', 'google:gemini-2.5-flash'], 'Groq primeiro (cota grátis maior); Gemini de reserva');
  const custom = candidates(free, 'coding', { NEXIA_MODELS_CODING: 'groq:moonshotai/kimi-k2, google:gemini-9, bad, x:y z' });
  assert.deepStrictEqual(custom.map(d => `${d.provider}:${d.model}`), ['groq:moonshotai/kimi-k2', 'google:gemini-9']);
  assert.deepStrictEqual(candidates({ capabilities: () => ({ available: false }) }, 'coding'), []);
});
