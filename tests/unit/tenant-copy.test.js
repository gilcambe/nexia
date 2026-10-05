'use strict';
// ADR-CLONE-01: duplicar tenant (partes puras) — o que entra, o que nunca entra e a tarefa da fila.
const test = require('node:test');
const assert = require('node:assert');
const { buildPlan, describe, sanitize, resolveInclude, INCLUDE } = require('../../nexia-ai/tenant-copy');
const { validateJob } = require('../../nexia-ai/jobs');

const cli = 'cli_' + 'a'.repeat(32), prj = 'prj_' + 'b'.repeat(32), repo = 'repo_' + 'c'.repeat(32);
const SRC = {
  tenant: { slug: 'ces', name: 'CES', ownerUid: 'u1', ownerEmail: 'dono@ces.com', plan: 'pro', planLimits: { maxMembers: 20 }, billing: { status: 'active', customerId: 'cus_1' },
    status: 'active', customDomain: 'ces.com.br', settings: { language: 'pt-BR', timezone: 'America/Sao_Paulo', webhookUrl: 'https://hooks.example/x' },
    theme: { primary: '#123456', logoUrl: 'https://cdn.ces.com/logo.svg', apiKey: 'AIza' + 'SyA-1234567890abcdefghijklmnopqrstu' } },
  subs: { config: [{ id: 'brand', data: { color: '#ff0000', contactEmail: 'oi@ces.com', note: 'fale com joao@ces.com', updatedAt: { toDate: () => new Date() } } }],
    modules: [{ id: 'crm', data: { enabled: true } }], robots: [{ id: 'r1', data: { name: 'Robô de follow-up', token: 'ghp_' + 'x'.repeat(36) } }] },
  records: {
    clients: [{ id: cli, name: 'CES', slug: 'ces', status: 'active', aliases: ['ces'], contacts: [{ name: 'Maria Souza', role: 'CEO' }], notes: 'CPF da Maria ...', identifiers: [] }],
    projects: [{ id: prj, client_id: cli, name: 'Site', slug: 'site', type: 'website', status: 'active', primary_repository_id: repo, autonomy_level: 2, stack: [] }],
    repositories: [{ id: repo, project_id: prj, provider: 'github', owner: 'gilcambe', repo: 'ces', default_branch: 'main', url: 'https://github.com/gilcambe/ces', branches: [] }],
    environments: [{ id: 'env_' + 'd'.repeat(32), project_id: prj, name: 'production', provider: 'cloudflare', urls: [], secret_refs: [{ name: 'NEXIA_CLOUDFLARE_CES_TOKEN', store: 'github_actions' }] }],
    'tool-policies': [{ id: 'pol_' + 'e'.repeat(32), project_id: prj, rules: [{ tool: 'github.*', decision: 'confirm' }] }],
  },
};

test('TD1. include: lista válida, ordem fixa e dependências (projetos puxam clientes; repositórios puxam projetos)', () => {
  assert.deepStrictEqual(resolveInclude(undefined).include, INCLUDE);
  assert.deepStrictEqual(resolveInclude(['repositories']), { include: ['clients', 'projects', 'repositories'], added: ['clients', 'projects'] });
  assert.deepStrictEqual(resolveInclude(['settings']).include, ['settings']);
  for (const bad of [['users'], ['executions'], 'clients', [1]]) assert.throws(() => resolveInclude(bad), e => e.code === 'VALIDATION', JSON.stringify(bad));
});

test('TD2. plano: copia configuração; nunca dono, plano, cobrança, domínio, webhooks, segredos, e-mails, contatos ou secret_refs', () => {
  const plan = buildPlan(SRC, { include: INCLUDE, name: 'CES (cópia)', target: 'ces-2' });
  assert.deepStrictEqual(plan.tenant, { settings: { language: 'pt-BR', timezone: 'America/Sao_Paulo' }, theme: { primary: '#123456', logoUrl: 'https://cdn.ces.com/logo.svg' }, slug: 'ces-2', name: 'CES (cópia)' });
  assert.deepStrictEqual(plan.subs, { config: [{ id: 'brand', data: { color: '#ff0000' } }], modules: [{ id: 'crm', data: { enabled: true } }], robots: [{ id: 'r1', data: { name: 'Robô de follow-up' } }] });
  assert.deepStrictEqual(Object.keys(plan.records.clients[0].data).sort(), ['aliases', 'identifiers', 'name', 'slug', 'status']);
  assert.strictEqual(plan.records.projects[0].data.primary_repository_id, undefined, 'remapeado depois');
  assert.strictEqual(plan.records.projects[0].primary_repository_id, repo);
  assert.strictEqual(plan.records.environments[0].data.secret_refs, undefined);
  for (const p of ['settings.webhookUrl', 'theme.apiKey', 'config/brand.contactEmail', 'config/brand.note', 'robots/r1.token', 'Client.contacts', 'Client.notes', 'Environment.secret_refs']) {
    assert.ok(plan.removed.includes(p), p);
  }
  const all = JSON.stringify(plan);
  for (const v of ['dono@ces.com', 'cus_1', 'ces.com.br', 'hooks.example', 'AIza', 'ghp_', 'Maria', 'CPF', 'NEXIA_CLOUDFLARE_CES_TOKEN', '"pro"', 'u1']) assert.ok(!all.includes(v), v);
  const d = describe(plan);
  assert.deepStrictEqual(d.counts, { clients: 1, projects: 1, repositories: 1, environments: 1, 'tool-policies': 1 });
  assert.ok(d.never_copied.some(x => /segredos/.test(x)) && d.never_copied.some(x => /usuários/.test(x)));
  assert.ok(!JSON.stringify(d).includes('#123456'), 'o resumo não traz valores de configuração');
});

test('TD3. sanitize: chaves sensíveis, segredos pelo detector, e-mails e datas saem; o resto fica', () => {
  const removed = [];
  const out = sanitize({ a: 1, nested: { password: 'x', ok: 'texto', list: ['ok', 'sk-ant-' + 'a'.repeat(30)] }, createdAt: 'x', when: new Date() }, '', removed);
  assert.deepStrictEqual(out, { a: 1, nested: { ok: 'texto', list: ['ok'] } });
  assert.deepStrictEqual(removed.sort(), ['createdAt', 'nested.list[1]', 'nested.password', 'when']);
});

test('TD4. fila: tarefa tenant.duplicate leva só ids (origem, destino, quem pediu)', () => {
  const actor = { type: 'user', id: 'uid123' };
  assert.deepStrictEqual(validateJob({ kind: 'tenant.duplicate', tenant: 'ces', target: 'ces-2', actor, name: 'não vai', include: ['x'] }),
    { kind: 'tenant.duplicate', tenant: 'ces', actor, target: 'ces-2' });
  for (const target of [undefined, 'ces', '../x', 'A']) assert.throws(() => validateJob({ kind: 'tenant.duplicate', tenant: 'ces', target, actor }), /target/);
});
