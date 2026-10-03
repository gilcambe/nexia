'use strict';
// Dados de teste do Vault: o próprio projeto NEXIA, com fatos verificáveis no
// repositório (gilcambe/nexia, commits e contagens da Fase 1 em PHASE-1-REPORT.md,
// variáveis de ambiente usadas pelo código, projeto Firebase nexia-c8710).
// Secrets aparecem só como NOME de variável.

const PHASE1_MERGE = 'c2bc081a7a102a44e00c5ca0c77984c2ebb44ecd';     // merge do PR #1 em develop
const PHASE1_CI_COMMIT = '196ffe031c4e15f55eca64f72d0abaa4feec0d47';  // CI verde da Fase 1
const OWNER = { type: 'user', id: 'gilcambe' };

const valid = {
  Client: () => ({
    name: 'NEXIA', slug: 'nexia', status: 'active',
    identifiers: [{ kind: 'github_org', value: 'gilcambe' }],
    contacts: [{ name: 'Gildivan Bezerra', role: 'dono' }],
  }),
  Project: ids => ({
    client_id: ids.Client, name: 'NEXIA OS', slug: 'nexia-os', type: 'saas', status: 'active',
    description: 'Plataforma NEXIA OS (servidor Node + SPA React/Vite + Firebase).',
    stack: ['node', 'react', 'vite', 'firebase', 'tailwindcss'], aliases: ['nexia', 'cortex'],
    autonomy_level: 0,
  }),
  Repository: ids => ({
    project_id: ids.Project, provider: 'github', owner: 'gilcambe', repo: 'nexia',
    default_branch: 'develop', branches: ['develop', 'nexia-ai/fase-2'], url: 'https://github.com/gilcambe/nexia',
  }),
  Environment: ids => ({
    project_id: ids.Project, name: 'production', provider: 'render', urls: ['https://nexia-os.onrender.com'],
    secret_refs: [
      { name: 'FIREBASE_SERVICE_ACCOUNT_BASE64', store: 'render', description: 'Service account do Admin SDK' },
      { name: 'GROQ_API_KEY', store: 'render' },
      { name: 'MASTER_EMAIL', store: 'render' },
    ],
  }),
  Requirement: ids => ({
    project_id: ids.Project, title: 'Vault em coleções vault_* no Firestore nexia-c8710',
    description: 'MIGRATION-PLAN.md, Fase 2: modelo de dados do Vault sem banco paralelo.',
    source: 'spec', priority: 'high', status: 'in_progress',
  }),
  Decision: ids => ({
    project_id: ids.Project, title: 'D3: Vault no Firestore existente', kind: 'architecture',
    decision: 'Usar o Firestore nexia-c8710 com coleções de prefixo vault_.',
    rationale: 'Evita banco paralelo e reaproveita Admin SDK, regras e emulador já usados no projeto.',
    decided_at: '2026-10-02T00:00:00.000Z', author: OWNER, status: 'accepted',
  }),
  Task: ids => ({
    project_id: ids.Project, title: 'Fase 2: modelo de dados do Vault', priority: 'high', status: 'in_progress',
    assignee: { type: 'agent', id: 'claude-code' }, requirement_id: ids.Requirement,
  }),
  Artifact: ids => ({
    project_id: ids.Project, kind: 'document', title: 'Registro de decisões de arquitetura',
    uri: 'ARCHITECTURE-DECISIONS.md', repository_id: ids.Repository, mime_type: 'text/markdown',
  }),
  Conversation: ids => ({
    project_id: ids.Project, title: 'Autorização da Fase 2', source: 'chat',
    summary: 'O dono autorizou somente a Fase 2 (Vault), sem deploy e sem publicar regras.',
    participants: [OWNER], started_at: '2026-10-02T03:00:00.000Z',
  }),
  Memory: ids => ({
    client_id: ids.Client, project_id: ids.Project, layer: 'preference',
    content: 'Fases são autorizadas uma por vez, com escopo aprovado antes; nenhum deploy.',
    status: 'approved', approved_by: OWNER, source_conversation_id: ids.Conversation,
  }),
  Change: ids => ({
    project_id: ids.Project, task_id: ids.Task, repository_id: ids.Repository, kind: 'code',
    summary: 'Fase 1: segurança, linha de base e CI (merge do PR #1 em develop).',
    branch: 'develop', commit_sha: PHASE1_MERGE, files: ['server.js', 'lib/safe-static.js', 'firestore.rules'],
    pr_url: 'https://github.com/gilcambe/nexia/pull/1', status: 'applied',
  }),
  TestRun: ids => ({
    project_id: ids.Project, change_id: ids.Change, suite: 'Playwright regressão (CI da Fase 1)',
    status: 'passed', started_at: '2026-10-02T02:14:36.000Z', totals: { passed: 48, failed: 0, skipped: 0 },
    commit_sha: PHASE1_CI_COMMIT,
  }),
  Deployment: ids => ({
    project_id: ids.Project, environment_id: ids.Environment, release: '59.0.0', commit_sha: PHASE1_MERGE,
    provider: 'render', status: 'pending', started_at: '2026-10-02T03:01:18.000Z',
  }),
  Error: ids => ({
    project_id: ids.Project, kind: 'test', severity: 'medium',
    message: 'Suíte READDY original: 20 falhas já existentes no develop (readdy-known-failures.json).',
    occurrences: 1, first_seen_at: '2026-10-02T00:00:00.000Z', last_seen_at: '2026-10-02T02:14:36.000Z',
    status: 'open', test_run_id: ids.TestRun,
  }),
  Integration: ids => ({
    project_id: ids.Project, provider: 'firebase', status: 'active', external_ref: 'nexia-c8710',
    environment_id: ids.Environment, secret_refs: [{ name: 'FIREBASE_SERVICE_ACCOUNT_BASE64', store: 'render' }],
  }),
  ProjectSnapshot: ids => ({
    project_id: ids.Project, generated_at: '2026-10-02T03:30:00.000Z',
    stack: ['node', 'react', 'vite', 'firebase'], frameworks: ['react', 'vite', 'tailwindcss'],
    directory_structure: ['server.js', 'netlify/functions/', 'src/', 'nexia-ai/vault/', 'tests/'],
    commands: { dev: 'vite', test: 'npm test', build: 'vite build', start: 'node server.js' },
    repository_id: ids.Repository, default_branch: 'develop', environment_ids: [ids.Environment],
    deploy_target: 'render', firebase_project: 'nexia-c8710',
    last_deployment_id: ids.Deployment, recent_error_ids: [ids.Error], open_task_ids: [ids.Task],
    key_decision_ids: [ids.Decision],
  }),
  ToolCall: ids => ({
    project_id: ids.Project, environment: 'staging', tool: 'github.get_checks', risk: 'LOW', decision: 'auto',
    decision_reason: 'Risco LOW (leitura/análise).', status: 'succeeded', requested_by: { type: 'agent', id: 'qa' },
    requested_at: '2026-10-02T16:00:00.000Z', decided_by: { type: 'system', id: 'policy-engine' }, decided_at: '2026-10-02T16:00:00.000Z',
    input_summary: 'ref develop', input_sha256: 'a'.repeat(64), output_summary: 'gilcambe/nexia: 2 check(s) (success 2)', duration_ms: 412,
    execution_id: 'exe_teste',
  }),
  ToolPolicy: ids => ({
    project_id: ids.Project, rules: [{ tool: 'github.*', environment: 'production', decision: 'forbidden' }, { tool: 'vault.*', decision: 'auto' }],
  }),
  Execution: ids => ({
    project_id: ids.Project, client_id: ids.Client, execution_id: 'exec_fixture_0001', requested_by: { type: 'user', id: 'gilcambe' },
    request_summary: 'Corrija o formulário de contato e abra um PR', intent: 'change', status: 'waiting_approval',
    plan: [{ step: 1, agent: 'architect', goal: 'Analisar o impacto', status: 'done', model: 'anthropic/claude-opus-5-5', tool_call_ids: [ids.ToolCall], attempts: 1, summary: 'Formulário em src/contato.js' },
      { step: 2, agent: 'coder', goal: 'Implementar na branch nexia/', status: 'waiting_approval', attempts: 1 }],
    gates: [{ gate: 1, name: 'typecheck', status: 'pending' }],
    budget: { max_steps: 12, max_tool_calls: 40, max_tokens: 400000, max_ms: 900000 },
    usage: { tool_calls: 3, input_tokens: 12000, output_tokens: 900, cost_usd_micros: 0, cost_known: false, duration_ms: 42000 },
    models: ['anthropic/claude-opus-5-5'], started_at: '2026-10-02T17:00:00.000Z',
  }),
};

// Ordem de criação que respeita as dependências.
const ORDER = ['Client', 'Project', 'Repository', 'Environment', 'Requirement', 'Decision', 'Task', 'Artifact',
  'Conversation', 'Memory', 'Change', 'TestRun', 'Deployment', 'Error', 'Integration', 'ProjectSnapshot', 'ToolCall', 'ToolPolicy', 'Execution'];

// Um caso inválido por entidade (regra de schema específica da entidade).
const invalid = {
  Client: ids => ({ ...valid.Client(ids), slug: 'NEXIA OS' }),                         // slug fora do padrão
  Project: ids => ({ ...valid.Project(ids), autonomy_level: 6 }),                    // nível 0–5
  Repository: ids => ({ ...valid.Repository(ids), url: 'http://github.com/gilcambe/nexia' }), // só https
  Environment: ids => ({ ...valid.Environment(ids), name: 'prod' }),                 // enum
  Requirement: ids => ({ ...valid.Requirement(ids), priority: 'urgent' }),           // enum
  Decision: ids => { const d = valid.Decision(ids); delete d.rationale; return d; }, // obrigatório
  Task: ids => ({ ...valid.Task(ids), depends_on: ['tsk_1'] }),                       // ref malformada
  Artifact: ids => ({ ...valid.Artifact(ids), uri: '../.env' }),                     // caminho fora do repo
  Conversation: ids => ({ ...valid.Conversation(ids), ended_at: '2026-10-01T00:00:00.000Z' }), // fim antes do início
  Memory: ids => ({ ...valid.Memory(ids), approved_by: undefined }),                 // aprovada sem aprovador
  Change: ids => ({ ...valid.Change(ids), commit_sha: 'c2bc081' }),                  // sha curto
  TestRun: ids => ({ ...valid.TestRun(ids), totals: { passed: 48, failed: -1, skipped: 0 } }),
  Deployment: ids => ({ ...valid.Deployment(ids), finished_at: '2026-10-01T00:00:00.000Z' }),
  Error: ids => ({ ...valid.Error(ids), status: 'resolved' }),                       // resolvido sem resolução
  Integration: ids => ({ ...valid.Integration(ids), provider: 'aws' }),              // enum
  ProjectSnapshot: ids => ({ ...valid.ProjectSnapshot(ids), firebase_project: 'Nexia C8710' }),
  ToolCall: ids => ({ ...valid.ToolCall(ids), status: 'pending_approval' }),            // pendente exige decisão confirm
  ToolPolicy: ids => ({ ...valid.ToolPolicy(ids), rules: [{ tool: 'GitHub/*', decision: 'auto' }] }), // padrão de nome
  Execution: ids => ({ ...valid.Execution(ids), status: 'succeeded' }),                 // final sem finished_at
};

const expectedInvalidRule = {
  Client: 'pattern:slug', Project: 'max', Repository: 'url:https', Environment: 'enum', Requirement: 'enum',
  Decision: 'required', Task: 'ref:Task', Artifact: 'pattern:https_or_repo_path', Conversation: 'ended_at>=started_at',
  Memory: 'approved_requires_approved_by', Change: 'type:sha', TestRun: 'min', Deployment: 'finished_at>=started_at',
  Error: 'resolved_requires_resolution', Integration: 'enum', ProjectSnapshot: 'pattern:firebase_project_id',
  ToolCall: 'pending_requires_confirm', ToolPolicy: 'pattern:tool_pattern', Execution: 'final_requires_finished_at',
};

// Valores com forma de secret, montados em tempo de execução com bytes aleatórios
// (nenhum valor real; nada fica literal no código-fonte).
const crypto = require('crypto');
const rnd = (n, abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') =>
  Array.from(crypto.randomBytes(n), b => abc[b % abc.length]).join('');
const b64url = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const fakeSecrets = () => ({
  private_key_pem: ['-----BEGIN', 'PRIVATE KEY-----'].join(' ') + '\n' + crypto.randomBytes(48).toString('base64'),
  jwt: [b64url({ alg: 'HS256', typ: 'JWT' }), b64url({ sub: rnd(12) }), rnd(43)].join('.'),
  github_token: 'gh' + 'p_' + rnd(36),
  groq_key: 'gs' + 'k_' + rnd(52),
  aws_access_key: 'AK' + 'IA' + rnd(16, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'),
  secret_assignment: 'pass' + 'word=' + rnd(14),
  url_with_credentials: 'https://deploy:' + rnd(16) + '@api.render.com/deploy',
  long_hex: crypto.randomBytes(32).toString('hex'),
  high_entropy: crypto.randomBytes(36).toString('base64').replace(/[+/=]/g, 'x'),
});

module.exports = { valid, invalid, expectedInvalidRule, ORDER, OWNER, PHASE1_MERGE, fakeSecrets };
