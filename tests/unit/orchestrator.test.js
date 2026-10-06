'use strict';
// Fase 10: partes determinísticas do Orchestrator (intenção, plano, gates, orçamento, agentes).
const test = require('node:test');
const assert = require('node:assert');
const { classifyIntent, planFor, specialistFor } = require('../../nexia-ai/orchestrator');
const { evaluateGates, verdict } = require('../../nexia-ai/orchestrator/gates');
const { createMeter, compact } = require('../../nexia-ai/orchestrator/runtime');
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
    // Pedido de edição sem os verbos antigos (antes caía em "question" e nada era gravado).
    ['No app, edite só o arquivo AuthContext.tsx: apague o bloco do login de teste', 'change'],
    ['Substitua o texto do rodapé', 'change'], ['Exclua a página de código', 'change'],
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
  assert.deepStrictEqual(candidates(free, 'coding', {}).map(d => `${d.provider}:${d.model}`), ['groq:openai/gpt-oss-120b', 'groq:qwen/qwen3.8-27b',
    'groq:moonshotai/kimi-k2-instruct-0905', 'groq:llama-3.3-70b-versatile', 'groq:openai/gpt-oss-20b', 'groq:meta-llama/llama-4-scout-17b-16e-instruct',
    'google:gemini-flash-latest', 'google:gemini-2.5-flash', 'google:gemini-flash-lite-latest', 'google:gemini-2.5-flash-lite'], 'Groq primeiro (cota grátis por modelo); Gemini de reserva (cota por modelo)');
  // ADR-FREE-04: a lista grátis só tem provedores grátis e vários deles (cotas separadas).
  const { FREE } = require('../../nexia-ai/orchestrator/models');
  for (const cls of Object.keys(FREE)) {
    const provs = new Set(FREE[cls].map(d => d.provider));
    // ADR-FREE-05: Cerebras fora (o "grátis" exige cartão); Kilo, Codestral e NVIDIA NIM entram.
    for (const p of provs) assert.ok(['groq', 'github', 'google', 'codestral', 'nvidia', 'cloudflare', 'mistral', 'openrouter', 'kilo'].includes(p), `${cls}: ${p} não é grátis`);
    assert.ok(provs.size >= 8, `${cls}: precisa de vários provedores grátis`);
    assert.ok(FREE[cls].filter(d => d.provider === 'openrouter').every(d => d.model.endsWith(':free')));
    // A lista termina com vários modelos grátis do Kilo Gateway (sem chave: nunca fica sem candidato).
    const tail = FREE[cls].slice(-5);
    assert.ok(tail.every(d => d.provider === 'kilo' && /^auto:\d$/.test(d.model)), `${cls}: termina no Kilo`);
    assert.strictEqual(FREE[cls].findIndex(d => d.provider === 'kilo'), FREE[cls].length - 5, `${cls}: Kilo só no fim`);
    assert.ok(FREE[cls].filter(d => d.provider === 'groq').length >= 6, `${cls}: vários modelos Groq (cotas separadas)`);
  }
  const custom = candidates(free, 'coding', { NEXIA_MODELS_CODING: 'groq:moonshotai/kimi-k2, google:gemini-9, bad, x:y z' });
  assert.deepStrictEqual(custom.map(d => `${d.provider}:${d.model}`), ['groq:moonshotai/kimi-k2', 'google:gemini-9']);
  assert.deepStrictEqual(candidates({ capabilities: () => ({ available: false }) }, 'coding'), []);
});

test('U9. compact: só os 2 resultados de ferramenta mais recentes vão inteiros (cota de tokens por minuto)', () => {
  const big = n => `RESULTADO DAS FERRAMENTAS (JSON):\n${String(n).repeat(5000)}`;
  const msgs = [{ role: 'user', content: 'pedido '.repeat(1000) }, { role: 'assistant', content: 'a' }, { role: 'user', content: big(1) },
    { role: 'assistant', content: 'b' }, { role: 'user', content: big(2) }, { role: 'assistant', content: 'c' }, { role: 'user', content: big(3) }];
  const out = compact(msgs);
  assert.strictEqual(out[0].content, msgs[0].content, 'o pedido nunca é cortado');
  assert.ok(out[2].content.length < 1700 && /resumido/.test(out[2].content));
  assert.strictEqual(out[4].content, msgs[4].content);
  assert.strictEqual(out[6].content, msgs[6].content);
  assert.strictEqual(msgs[2].content.length, big(1).length, 'não altera o histórico original');
});

test('U10. ADR-Q-03: "crie um site/sistema" passa pelo Designer; mudança num site existente não', () => {
  const { buildKind, planFor } = require('../../nexia-ai/orchestrator');
  assert.strictEqual(buildKind('Crie um site para a padaria Pão da Serra'), 'site');
  assert.strictEqual(buildKind('Faça uma landing page para minha academia'), 'site');
  assert.strictEqual(buildKind('Desenvolva um sistema de agendamento para clínica'), 'system');
  const { classifyIntent } = require('../../nexia-ai/orchestrator');
  assert.strictEqual(classifyIntent('Desenvolva um sistema de agendamento para clínica'), 'change');
  assert.strictEqual(classifyIntent('Monte uma landing page para a academia'), 'change');
  assert.strictEqual(classifyIntent('Crie um site e publique em produção'), 'deploy_production', 'deploy continua com prioridade');
  assert.strictEqual(buildKind('Crie a página de contato do Site Alfa'), null);
  assert.strictEqual(buildKind('Corrija o botão de enviar do Site Alfa'), null);
  const plan = planFor('change', 'Crie um site para a padaria');
  assert.deepStrictEqual(plan.slice(0, 3).map(p => [p.agent, p.action]), [['coder', 'create_branch'], ['designer', 'design_spec'], ['frontend', 'agent:implement']]);
  assert.strictEqual(planFor('change', 'Corrija o rodapé do Site Alfa')[0].agent, 'architect');
  assert.ok(allowed('designer', 'media.search_images') && !allowed('designer', 'github.commit_files'));
  assert.ok(allowed('frontend', 'media.search_videos'));
});
