'use strict';
// Schemas do Vault (spec §5, §21, §25). Cada entidade:
//   entity, collection (prefixo vault_), idPrefix, schemaVersion, fields,
//   unique (combinações únicas por tenant), atLeastOne, checks.
// Campos de metadados (id, tenant_id, schemaVersion, version, created_at,
// updated_at, deleted_at, created_by, updated_by, last_execution_id) são
// gravados pelo servidor e NÃO podem vir na entrada.
const { t } = require('./validate');

const PRIORITY = ['low', 'medium', 'high', 'critical'];
const ENV_NAMES = ['development', 'staging', 'production', 'preview'];
const HOSTING_PROVIDERS = ['render', 'firebase', 'cloudflare', 'vercel', 'netlify', 'github_pages', 'local', 'other'];
const SECRET_STORES = ['env', 'render', 'github_actions', 'gcp_secret_manager', 'firebase', 'cloudflare', 'vercel', 'netlify', 'local_env_file', 'other'];

// Referência a secret: só o NOME da variável e onde ele está guardado. Nunca o valor.
const secretRef = t.object({
  name: t.string({ required: true, max: 128, pattern: /^[A-Z][A-Z0-9_]*$/, patternName: 'env_var_name' }),
  store: t.enum(SECRET_STORES, { required: true }),
  ref: t.string({ max: 256, pattern: /^[A-Za-z0-9_./:@-]+$/, patternName: 'secret_store_path' }),
  description: t.string({ max: 300 }),
});

const actorRef = t.object({
  type: t.enum(['user', 'agent', 'system'], { required: true }),
  id: t.string({ required: true, max: 128, pattern: /^[A-Za-z0-9_.:@-]+$/, patternName: 'actor_id' }),
});

const COMMIT = [40, 64];

const RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const TOOL_DECISIONS = ['auto', 'confirm', 'forbidden'];
const TOOL_NAME = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
const TOOL_PATTERN = /^(\*|[a-z][a-z0-9_]*(\.([a-z][a-z0-9_]*|\*))+)$/;

const ordered = (a, b) => v => !(v[a] && v[b]) || v[a] <= v[b];

const SCHEMAS = {
  Client: {
    collection: 'vault_clients', idPrefix: 'cli', schemaVersion: 1,
    fields: {
      name: t.string({ required: true }),
      slug: t.slug({ required: true, immutable: true }),
      status: t.enum(['prospect', 'active', 'paused', 'archived'], { required: true }),
      aliases: t.array(t.string({ max: 100 }), { max: 20, unique: true, default: () => [] }),
      // Identificadores não sensíveis (ex.: domínio, nome de marca, conta GitHub)
      identifiers: t.array(t.object({
        kind: t.enum(['domain', 'brand', 'github_org', 'legal_name', 'other'], { required: true }),
        value: t.string({ required: true, max: 200 }),
      }), { max: 20, default: () => [] }),
      contacts: t.array(t.object({
        name: t.string({ required: true, max: 120 }),
        role: t.string({ max: 120 }),
      }), { max: 20, default: () => [] }),
      notes: t.text({ max: 4000 }),
    },
    unique: [['slug']],
  },

  Project: {
    collection: 'vault_projects', idPrefix: 'prj', schemaVersion: 1,
    fields: {
      client_id: t.ref('Client', { required: true, immutable: true }),
      name: t.string({ required: true }),
      slug: t.slug({ required: true, immutable: true }),
      description: t.text({ max: 4000 }),
      type: t.enum(['web_app', 'mobile_app', 'api', 'website', 'landing_page', 'saas', 'automation', 'library', 'other'], { required: true }),
      status: t.enum(['planning', 'active', 'maintenance', 'paused', 'archived'], { required: true }),
      stack: t.array(t.string({ max: 80 }), { max: 50, unique: true, default: () => [] }),
      aliases: t.array(t.string({ max: 100 }), { max: 20, unique: true, default: () => [] }),
      workspace: t.object({
        local_path: t.string({ required: true, max: 500 }),
        machine_label: t.string({ max: 120 }),
      }),
      primary_repository_id: t.ref('Repository'),
      autonomy_level: t.int({ min: 0, max: 5, default: 0 }), // spec §23; 0 = somente leitura
    },
    unique: [['slug']],
  },

  Repository: {
    collection: 'vault_repositories', idPrefix: 'repo', schemaVersion: 1,
    fields: {
      project_id: t.ref('Project', { required: true, immutable: true }),
      provider: t.enum(['github', 'gitlab', 'bitbucket', 'other'], { required: true, immutable: true }),
      owner: t.string({ required: true, max: 100, pattern: /^[A-Za-z0-9_.-]+$/, patternName: 'repo_owner', immutable: true }),
      repo: t.string({ required: true, max: 100, pattern: /^[A-Za-z0-9_.-]+$/, patternName: 'repo_name', immutable: true }),
      default_branch: t.string({ required: true, max: 255, pattern: /^[A-Za-z0-9._/-]+$/, patternName: 'branch' }),
      branches: t.array(t.string({ max: 255, pattern: /^[A-Za-z0-9._/-]+$/, patternName: 'branch' }), { max: 200, unique: true, default: () => [] }),
      url: t.url({ required: true }),
      visibility: t.enum(['public', 'private', 'unknown'], { default: 'unknown' }),
    },
    unique: [['provider', 'owner', 'repo']],
  },

  Environment: {
    collection: 'vault_environments', idPrefix: 'env', schemaVersion: 1,
    fields: {
      project_id: t.ref('Project', { required: true, immutable: true }),
      name: t.enum(ENV_NAMES, { required: true, immutable: true }),
      provider: t.enum(HOSTING_PROVIDERS, { required: true }),
      urls: t.array(t.url(), { max: 20, unique: true, default: () => [] }),
      branch: t.string({ max: 255, pattern: /^[A-Za-z0-9._/-]+$/, patternName: 'branch' }),
      // Somente referências: nome da variável + secret store. Valores são rejeitados.
      secret_refs: t.array(secretRef, { max: 100, default: () => [] }),
      notes: t.text({ max: 2000 }),
    },
    unique: [['project_id', 'name']],
  },

  Requirement: {
    collection: 'vault_requirements', idPrefix: 'req', schemaVersion: 1,
    fields: {
      project_id: t.ref('Project', { required: true, immutable: true }),
      title: t.string({ required: true }),
      description: t.text(),
      source: t.enum(['client', 'user', 'internal', 'spec', 'agent'], { required: true }),
      priority: t.enum(PRIORITY, { required: true }),
      status: t.enum(['proposed', 'approved', 'in_progress', 'done', 'rejected'], { required: true }),
    },
  },

  Decision: {
    collection: 'vault_decisions', idPrefix: 'dec', schemaVersion: 1,
    fields: {
      project_id: t.ref('Project', { required: true, immutable: true }),
      title: t.string({ required: true }),
      kind: t.enum(['architecture', 'business', 'technical', 'process'], { required: true }),
      decision: t.text({ required: true }),
      rationale: t.text({ required: true }),
      decided_at: t.timestamp({ required: true }),
      author: { ...actorRef, required: true },
      status: t.enum(['proposed', 'accepted', 'superseded', 'rejected'], { required: true }),
      supersedes_id: t.ref('Decision'),
    },
  },

  Task: {
    collection: 'vault_tasks', idPrefix: 'tsk', schemaVersion: 1,
    fields: {
      project_id: t.ref('Project', { required: true, immutable: true }),
      title: t.string({ required: true }),
      description: t.text(),
      priority: t.enum(PRIORITY, { required: true }),
      status: t.enum(['todo', 'in_progress', 'blocked', 'done', 'cancelled'], { required: true }),
      assignee: actorRef,
      depends_on: t.array(t.ref('Task'), { max: 50, unique: true, default: () => [] }),
      requirement_id: t.ref('Requirement'),
    },
  },

  Artifact: {
    collection: 'vault_artifacts', idPrefix: 'art', schemaVersion: 1,
    fields: {
      project_id: t.ref('Project', { required: true, immutable: true }),
      kind: t.enum(['document', 'design', 'spec', 'asset', 'file', 'other'], { required: true }),
      title: t.string({ required: true }),
      // URL https ou caminho no repositório (relativo, sem '..')
      uri: t.string({ required: true, max: 2048, pattern: /^(https:\/\/[^\s]+|(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9_./ -]+)$/, patternName: 'https_or_repo_path' }),
      repository_id: t.ref('Repository'),
      content_sha256: t.sha([64]),
      mime_type: t.string({ max: 100, pattern: /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/, patternName: 'mime' }),
    },
  },

  Conversation: {
    collection: 'vault_conversations', idPrefix: 'cnv', schemaVersion: 1,
    fields: {
      project_id: t.ref('Project', { required: true, immutable: true }),
      title: t.string({ required: true }),
      summary: t.text({ required: true }),
      source: t.enum(['cortex', 'chat', 'email', 'meeting', 'other'], { required: true }),
      // Referência ao registro de origem (ex.: id de cortex_memory), não o conteúdo
      external_ref: t.string({ max: 300, pattern: /^[A-Za-z0-9_./:@-]+$/, patternName: 'external_ref' }),
      participants: t.array(actorRef, { max: 50, default: () => [] }),
      started_at: t.timestamp({ required: true }),
      ended_at: t.timestamp(),
    },
    checks: [[ordered('started_at', 'ended_at'), 'ended_at>=started_at']],
  },

  Memory: {
    collection: 'vault_memories', idPrefix: 'mem', schemaVersion: 1,
    fields: {
      client_id: t.ref('Client', { immutable: true }),
      project_id: t.ref('Project', { immutable: true }),
      layer: t.enum(['identity', 'fact', 'decision', 'state', 'preference', 'history', 'derived'], { required: true }),
      content: t.text({ required: true, max: 4000 }),
      status: t.enum(['pending', 'approved', 'rejected', 'expired'], { required: true }),
      approved_by: actorRef,
      source_conversation_id: t.ref('Conversation'),
      expires_at: t.timestamp(),
    },
    atLeastOne: [['client_id', 'project_id']],
    checks: [[v => v.status !== 'approved' || !!v.approved_by, 'approved_requires_approved_by']],
  },

  Change: {
    collection: 'vault_changes', idPrefix: 'chg', schemaVersion: 1,
    fields: {
      project_id: t.ref('Project', { required: true, immutable: true }),
      task_id: t.ref('Task'),
      repository_id: t.ref('Repository'),
      kind: t.enum(['code', 'config', 'infra', 'data', 'docs'], { required: true }),
      summary: t.text({ required: true, max: 2000 }),
      branch: t.string({ max: 255, pattern: /^[A-Za-z0-9._/-]+$/, patternName: 'branch' }),
      commit_sha: t.sha(COMMIT),
      files: t.array(t.string({ max: 500, pattern: /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[^\0]+$/, patternName: 'repo_path' }), { max: 500, default: () => [] }),
      pr_url: t.url(),
      status: t.enum(['proposed', 'applied', 'reverted'], { required: true }),
    },
  },

  TestRun: {
    collection: 'vault_test_runs', idPrefix: 'trn', schemaVersion: 1,
    fields: {
      project_id: t.ref('Project', { required: true, immutable: true }),
      environment_id: t.ref('Environment'),
      change_id: t.ref('Change'),
      suite: t.string({ required: true, max: 200 }),
      status: t.enum(['running', 'passed', 'failed', 'error', 'skipped'], { required: true }),
      started_at: t.timestamp({ required: true }),
      duration_ms: t.int({ max: 7 * 24 * 3600 * 1000 }),
      totals: t.object({
        passed: t.int({ required: true }),
        failed: t.int({ required: true }),
        skipped: t.int({ required: true }),
      }),
      commit_sha: t.sha(COMMIT),
      evidence_url: t.url(),
    },
  },

  Deployment: {
    collection: 'vault_deployments', idPrefix: 'dpl', schemaVersion: 1,
    fields: {
      project_id: t.ref('Project', { required: true, immutable: true }),
      environment_id: t.ref('Environment', { required: true, immutable: true }),
      version: t.string({ required: true, max: 100 }),
      commit_sha: t.sha(COMMIT, { required: true }),
      provider: t.enum(HOSTING_PROVIDERS, { required: true }),
      status: t.enum(['pending', 'in_progress', 'succeeded', 'failed', 'rolled_back'], { required: true }),
      started_at: t.timestamp({ required: true }),
      finished_at: t.timestamp(),
      url: t.url(),
      approved_by: actorRef,
    },
    checks: [[ordered('started_at', 'finished_at'), 'finished_at>=started_at']],
  },

  Error: {
    collection: 'vault_errors', idPrefix: 'err', schemaVersion: 1,
    fields: {
      project_id: t.ref('Project', { required: true, immutable: true }),
      kind: t.enum(['tool', 'build', 'test', 'runtime', 'deploy', 'integration', 'other'], { required: true }),
      severity: t.enum(PRIORITY, { required: true }),
      message: t.text({ required: true, max: 2000 }),
      context: t.text({ max: 4000 }),
      occurrences: t.int({ min: 1, default: 1 }),
      first_seen_at: t.timestamp({ required: true }),
      last_seen_at: t.timestamp({ required: true }),
      status: t.enum(['open', 'investigating', 'resolved', 'ignored'], { required: true }),
      resolution: t.text({ max: 4000 }),
      deployment_id: t.ref('Deployment'),
      test_run_id: t.ref('TestRun'),
    },
    checks: [
      [ordered('first_seen_at', 'last_seen_at'), 'last_seen_at>=first_seen_at'],
      [v => v.status !== 'resolved' || !!v.resolution, 'resolved_requires_resolution'],
    ],
  },

  Integration: {
    collection: 'vault_integrations', idPrefix: 'int', schemaVersion: 1,
    fields: {
      project_id: t.ref('Project', { required: true, immutable: true }),
      provider: t.enum(['github', 'firebase', 'cloudflare', 'render', 'local', 'other'], { required: true, immutable: true }),
      status: t.enum(['pending', 'active', 'disabled', 'error'], { required: true }),
      // Identificador público do recurso externo (ex.: id do projeto Firebase, conta Cloudflare)
      external_ref: t.string({ max: 300, pattern: /^[A-Za-z0-9_./:@-]+$/, patternName: 'external_ref' }),
      repository_id: t.ref('Repository'),
      environment_id: t.ref('Environment'),
      secret_refs: t.array(secretRef, { max: 50, default: () => [] }),
      notes: t.text({ max: 2000 }),
    },
  },

  ProjectSnapshot: {
    collection: 'vault_project_snapshots', idPrefix: 'snp', schemaVersion: 1,
    fields: {
      project_id: t.ref('Project', { required: true, immutable: true }),
      generated_at: t.timestamp({ required: true }),
      stack: t.array(t.string({ max: 80 }), { max: 50, default: () => [] }),
      frameworks: t.array(t.string({ max: 80 }), { max: 50, default: () => [] }),
      directory_structure: t.array(t.string({ max: 300 }), { max: 300, default: () => [] }),
      commands: t.object({
        dev: t.string({ max: 300 }),
        test: t.string({ max: 300 }),
        build: t.string({ max: 300 }),
        start: t.string({ max: 300 }),
      }),
      repository_id: t.ref('Repository'),
      default_branch: t.string({ max: 255, pattern: /^[A-Za-z0-9._/-]+$/, patternName: 'branch' }),
      environment_ids: t.array(t.ref('Environment'), { max: 20, unique: true, default: () => [] }),
      deploy_target: t.enum(HOSTING_PROVIDERS),
      firebase_project: t.string({ max: 100, pattern: /^[a-z0-9-]+$/, patternName: 'firebase_project_id' }),
      cloudflare_ref: t.string({ max: 200, pattern: /^[A-Za-z0-9_./:@-]+$/, patternName: 'external_ref' }),
      architecture: t.text({ max: 4000 }),
      patterns: t.array(t.string({ max: 300 }), { max: 50, default: () => [] }),
      last_deployment_id: t.ref('Deployment'),
      recent_error_ids: t.array(t.ref('Error'), { max: 20, unique: true, default: () => [] }),
      open_task_ids: t.array(t.ref('Task'), { max: 50, unique: true, default: () => [] }),
      key_decision_ids: t.array(t.ref('Decision'), { max: 30, unique: true, default: () => [] }),
    },
  },

  // Fase 6: Tool Gateway e Policy Engine (spec §15 "Níveis de risco", §16, §23).
  // Registro de cada chamada de ferramenta. Guarda só um resumo da entrada definido pela
  // própria ferramenta e o hash da entrada completa; nunca valores sensíveis.
  ToolCall: {
    collection: 'vault_tool_calls', idPrefix: 'tcl', schemaVersion: 1,
    fields: {
      project_id: t.ref('Project', { required: true, immutable: true }),
      environment: t.enum(ENV_NAMES, { immutable: true }),
      tool: t.string({ required: true, max: 100, pattern: TOOL_NAME, patternName: 'tool_name', immutable: true }),
      risk: t.enum(RISK_LEVELS, { required: true, immutable: true }),
      decision: t.enum(TOOL_DECISIONS, { required: true, immutable: true }),
      decision_reason: t.string({ required: true, max: 300, immutable: true }),
      status: t.enum(['pending_approval', 'running', 'succeeded', 'failed', 'rejected', 'denied', 'expired'], { required: true }),
      requested_by: { ...actorRef, required: true, immutable: true },
      requested_at: t.timestamp({ required: true, immutable: true }),
      decided_by: actorRef,
      decided_at: t.timestamp(),
      input_summary: t.string({ max: 500 }),
      input_sha256: t.sha([64], { required: true, immutable: true }),
      output_summary: t.text({ max: 2000 }),
      error_code: t.string({ max: 64, pattern: /^[A-Z0-9_]+$/, patternName: 'error_code' }),
      duration_ms: t.int({ max: 86400000 }),
      execution_id: t.string({ max: 128, pattern: /^[A-Za-z0-9_.:-]+$/, patternName: 'execution_id', immutable: true }),
    },
    checks: [
      [v => v.status !== 'pending_approval' || v.decision === 'confirm', 'pending_requires_confirm'],
      [v => v.status !== 'denied' || v.decision === 'forbidden', 'denied_requires_forbidden'],
      [ordered('requested_at', 'decided_at'), 'decided_at>=requested_at'],
    ],
  },

  // Política de ferramentas por projeto: regras que endurecem (ou, até HIGH fora de
  // produção, afrouxam) a decisão padrão do Policy Engine.
  ToolPolicy: {
    collection: 'vault_tool_policies', idPrefix: 'pol', schemaVersion: 1,
    fields: {
      project_id: t.ref('Project', { required: true, immutable: true }),
      rules: t.array(t.object({
        tool: t.string({ required: true, max: 100, pattern: TOOL_PATTERN, patternName: 'tool_pattern' }),
        environment: t.enum(ENV_NAMES),
        decision: t.enum(TOOL_DECISIONS, { required: true }),
      }), { max: 100, default: () => [] }),
      notes: t.text({ max: 2000 }),
    },
    unique: [['project_id']],
  },
};

for (const [entity, s] of Object.entries(SCHEMAS)) s.entity = entity;

const ENTITY_NAMES = Object.keys(SCHEMAS);
const idPattern = entity => new RegExp(`^${SCHEMAS[entity].idPrefix}_[0-9a-f]{32}$`);

module.exports = { SCHEMAS, ENTITY_NAMES, idPattern, SECRET_STORES, RISK_LEVELS, TOOL_DECISIONS, TOOL_NAME, ENV_NAMES };
