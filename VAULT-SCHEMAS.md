# Schemas do Vault (NEXIA AI, Fase 2)

> Gerado de `nexia-ai/vault/schemas.js` por `node nexia-ai/vault/schema-doc.js --write`. Não edite à mão: o teste unitário `tests/unit/vault-schemas.test.js` falha se este arquivo divergir dos schemas.

## Regras comuns

- Firestore `nexia-c8710`, coleções de primeiro nível com prefixo `vault_` (decisão D3). Todo documento carrega `tenant_id` (slug do tenant SaaS) e só é visível ao mesmo tenant.
- Metadados gravados só pelo servidor (rejeitados na entrada): `id`, `tenant_id`, `schemaVersion`, `version`, `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`, `last_execution_id`.
- `id` = `{prefixo}_{32 hex}`, gerado pelo servidor, igual ao id do documento. `version` começa em 1 e sobe a cada escrita (etag). Timestamps de metadados são do servidor.
- Campos desconhecidos são rejeitados. `null` só em campo opcional (no update, remove o campo). Todo texto passa pela detecção de secrets (exceto campos `sha` e `ref`).
- Secret stores aceitos em `secret_refs[].store`: `env`, `render`, `github_actions`, `gcp_secret_manager`, `firebase`, `cloudflare`, `vercel`, `netlify`, `local_env_file`, `other`. O schema guarda só o nome da variável; não existe campo para valor.
- Listagem: registros ativos do tenant, ordem `updated_at` desc, no máximo um filtro entre `client_id`, `project_id`, `status`.
- Integridade referencial na escrita: o registro referenciado existe, é do mesmo tenant, não está excluído e, se pertence a um projeto, é o mesmo projeto. Com `client_id` e `project_id`, o projeto precisa ser do cliente.
- Soft-delete é bloqueado enquanto houver registro ativo referenciando o alvo (coluna "Referenciado por").

## Resumo

| Entidade | Coleção | Prefixo do id | schemaVersion | Únicos por tenant | Referenciado por |
|---|---|---|---|---|---|
| Client | `vault_clients` | `cli_` | 1 | slug | Project.client_id, Memory.client_id, Execution.client_id |
| Project | `vault_projects` | `prj_` | 1 | slug | Repository.project_id, Environment.project_id, Requirement.project_id, Decision.project_id, Task.project_id, Artifact.project_id, Conversation.project_id, Memory.project_id, Change.project_id, TestRun.project_id, Deployment.project_id, Error.project_id, Integration.project_id, ProjectSnapshot.project_id, ToolCall.project_id, ToolPolicy.project_id, Execution.project_id |
| Repository | `vault_repositories` | `repo_` | 1 | provider + owner + repo | Project.primary_repository_id, Artifact.repository_id, Change.repository_id, Integration.repository_id, ProjectSnapshot.repository_id |
| Environment | `vault_environments` | `env_` | 1 | project_id + name | TestRun.environment_id, Deployment.environment_id, Integration.environment_id, ProjectSnapshot.environment_ids[] |
| Requirement | `vault_requirements` | `req_` | 1 |  | Task.requirement_id |
| Decision | `vault_decisions` | `dec_` | 1 |  | Decision.supersedes_id, ProjectSnapshot.key_decision_ids[] |
| Task | `vault_tasks` | `tsk_` | 1 |  | Task.depends_on[], Change.task_id, ProjectSnapshot.open_task_ids[] |
| Artifact | `vault_artifacts` | `art_` | 1 |  |  |
| Conversation | `vault_conversations` | `cnv_` | 1 |  | Memory.source_conversation_id, Execution.conversation_id |
| Memory | `vault_memories` | `mem_` | 1 |  |  |
| Change | `vault_changes` | `chg_` | 1 |  | TestRun.change_id |
| TestRun | `vault_test_runs` | `trn_` | 1 |  | Error.test_run_id |
| Deployment | `vault_deployments` | `dpl_` | 1 |  | Error.deployment_id, ProjectSnapshot.last_deployment_id, Execution.deployment_id |
| Error | `vault_errors` | `err_` | 1 |  | ProjectSnapshot.recent_error_ids[] |
| Integration | `vault_integrations` | `int_` | 1 |  |  |
| ProjectSnapshot | `vault_project_snapshots` | `snp_` | 1 |  |  |
| ToolCall | `vault_tool_calls` | `tcl_` | 1 |  |  |
| ToolPolicy | `vault_tool_policies` | `pol_` | 1 | project_id |  |
| Execution | `vault_executions` | `exe_` | 1 | execution_id |  |

## Client

Coleção `vault_clients`, id `cli_…`, schemaVersion 1.

| Campo | Tipo | Obrigatório | Imutável | Padrão | Restrições |
|---|---|---|---|---|---|
| `name` | string | sim |  |  | 1–200 caracteres |
| `slug` | string (slug) | sim | sim |  | 2–63 caracteres |
| `status` | enum | sim |  |  | `prospect`, `active`, `paused`, `archived` |
| `aliases` | array de string |  |  | [] | até 20 itens, sem repetição |
| `identifiers` | array de objeto |  |  | [] | até 20 itens |
| `identifiers[].kind` | enum | sim |  |  | `domain`, `brand`, `github_org`, `legal_name`, `other` |
| `identifiers[].value` | string | sim |  |  | 1–200 caracteres |
| `contacts` | array de objeto |  |  | [] | até 20 itens |
| `contacts[].name` | string | sim |  |  | 1–120 caracteres |
| `contacts[].role` | string |  |  |  | 1–120 caracteres |
| `notes` | string |  |  |  | 1–4000 caracteres |

Únicos por tenant: `slug`.

## Project

Coleção `vault_projects`, id `prj_…`, schemaVersion 1.

| Campo | Tipo | Obrigatório | Imutável | Padrão | Restrições |
|---|---|---|---|---|---|
| `client_id` | ref → Client | sim | sim |  |  |
| `name` | string | sim |  |  | 1–200 caracteres |
| `slug` | string (slug) | sim | sim |  | 2–63 caracteres |
| `description` | string |  |  |  | 1–4000 caracteres |
| `type` | enum | sim |  |  | `web_app`, `mobile_app`, `api`, `website`, `landing_page`, `saas`, `automation`, `library`, `other` |
| `status` | enum | sim |  |  | `planning`, `active`, `maintenance`, `paused`, `archived` |
| `stack` | array de string |  |  | [] | até 50 itens, sem repetição |
| `aliases` | array de string |  |  | [] | até 20 itens, sem repetição |
| `workspace` | objeto |  |  |  |  |
| `workspace.local_path` | string | sim |  |  | 1–500 caracteres |
| `workspace.machine_label` | string |  |  |  | 1–120 caracteres |
| `primary_repository_id` | ref → Repository |  |  |  |  |
| `autonomy_level` | int |  |  | 0 | 0–5 |
| `qa_checks` | array de objeto |  |  | [] | até 50 itens |
| `qa_checks[].gate` | int | sim |  |  | 1–7 |
| `qa_checks[].check` | string | sim |  |  | 1–200 caracteres |

Únicos por tenant: `slug`.

## Repository

Coleção `vault_repositories`, id `repo_…`, schemaVersion 1.

| Campo | Tipo | Obrigatório | Imutável | Padrão | Restrições |
|---|---|---|---|---|---|
| `project_id` | ref → Project | sim | sim |  |  |
| `provider` | enum | sim | sim |  | `github`, `gitlab`, `bitbucket`, `other` |
| `owner` | string (repo_owner) | sim | sim |  | 1–100 caracteres |
| `repo` | string (repo_name) | sim | sim |  | 1–100 caracteres |
| `default_branch` | string (branch) | sim |  |  | 1–255 caracteres |
| `branches` | array de string (branch) |  |  | [] | até 200 itens, sem repetição |
| `url` | url (https; http só em localhost) | sim |  |  |  |
| `visibility` | enum |  |  | "unknown" | `public`, `private`, `unknown` |

Únicos por tenant: `provider` + `owner` + `repo`.

## Environment

Coleção `vault_environments`, id `env_…`, schemaVersion 1.

| Campo | Tipo | Obrigatório | Imutável | Padrão | Restrições |
|---|---|---|---|---|---|
| `project_id` | ref → Project | sim | sim |  |  |
| `name` | enum | sim | sim |  | `development`, `staging`, `production`, `preview` |
| `provider` | enum | sim |  |  | `render`, `firebase`, `cloudflare`, `vercel`, `netlify`, `github_pages`, `local`, `other` |
| `urls` | array de url (https; http só em localhost) |  |  | [] | até 20 itens, sem repetição |
| `branch` | string (branch) |  |  |  | 1–255 caracteres |
| `secret_refs` | array de objeto |  |  | [] | até 100 itens |
| `secret_refs[].name` | string (env_var_name) | sim |  |  | 1–128 caracteres |
| `secret_refs[].store` | enum | sim |  |  | `env`, `render`, `github_actions`, `gcp_secret_manager`, `firebase`, `cloudflare`, `vercel`, `netlify`, `local_env_file`, `other` |
| `secret_refs[].ref` | string (secret_store_path) |  |  |  | 1–256 caracteres |
| `secret_refs[].description` | string |  |  |  | 1–300 caracteres |
| `notes` | string |  |  |  | 1–2000 caracteres |

Únicos por tenant: `project_id` + `name`.

## Requirement

Coleção `vault_requirements`, id `req_…`, schemaVersion 1.

| Campo | Tipo | Obrigatório | Imutável | Padrão | Restrições |
|---|---|---|---|---|---|
| `project_id` | ref → Project | sim | sim |  |  |
| `title` | string | sim |  |  | 1–200 caracteres |
| `description` | string |  |  |  | 1–8000 caracteres |
| `source` | enum | sim |  |  | `client`, `user`, `internal`, `spec`, `agent` |
| `priority` | enum | sim |  |  | `low`, `medium`, `high`, `critical` |
| `status` | enum | sim |  |  | `proposed`, `approved`, `in_progress`, `done`, `rejected` |

## Decision

Coleção `vault_decisions`, id `dec_…`, schemaVersion 1.

| Campo | Tipo | Obrigatório | Imutável | Padrão | Restrições |
|---|---|---|---|---|---|
| `project_id` | ref → Project | sim | sim |  |  |
| `title` | string | sim |  |  | 1–200 caracteres |
| `kind` | enum | sim |  |  | `architecture`, `business`, `technical`, `process` |
| `decision` | string | sim |  |  | 1–8000 caracteres |
| `rationale` | string | sim |  |  | 1–8000 caracteres |
| `decided_at` | timestamp | sim |  |  |  |
| `author` | objeto | sim |  |  |  |
| `author.type` | enum | sim |  |  | `user`, `agent`, `system` |
| `author.id` | string (actor_id) | sim |  |  | 1–128 caracteres |
| `status` | enum | sim |  |  | `proposed`, `accepted`, `superseded`, `rejected` |
| `supersedes_id` | ref → Decision |  |  |  |  |

## Task

Coleção `vault_tasks`, id `tsk_…`, schemaVersion 1.

| Campo | Tipo | Obrigatório | Imutável | Padrão | Restrições |
|---|---|---|---|---|---|
| `project_id` | ref → Project | sim | sim |  |  |
| `title` | string | sim |  |  | 1–200 caracteres |
| `description` | string |  |  |  | 1–8000 caracteres |
| `priority` | enum | sim |  |  | `low`, `medium`, `high`, `critical` |
| `status` | enum | sim |  |  | `todo`, `in_progress`, `blocked`, `done`, `cancelled` |
| `assignee` | objeto |  |  |  |  |
| `assignee.type` | enum | sim |  |  | `user`, `agent`, `system` |
| `assignee.id` | string (actor_id) | sim |  |  | 1–128 caracteres |
| `depends_on` | array de ref → Task |  |  | [] | até 50 itens, sem repetição |
| `requirement_id` | ref → Requirement |  |  |  |  |

## Artifact

Coleção `vault_artifacts`, id `art_…`, schemaVersion 1.

| Campo | Tipo | Obrigatório | Imutável | Padrão | Restrições |
|---|---|---|---|---|---|
| `project_id` | ref → Project | sim | sim |  |  |
| `kind` | enum | sim |  |  | `document`, `design`, `spec`, `asset`, `file`, `other` |
| `title` | string | sim |  |  | 1–200 caracteres |
| `uri` | string (https_or_repo_path) | sim |  |  | 1–2048 caracteres |
| `repository_id` | ref → Repository |  |  |  |  |
| `content_sha256` | sha (64 hex) |  |  |  |  |
| `mime_type` | string (mime) |  |  |  | 1–100 caracteres |

## Conversation

Coleção `vault_conversations`, id `cnv_…`, schemaVersion 1.

| Campo | Tipo | Obrigatório | Imutável | Padrão | Restrições |
|---|---|---|---|---|---|
| `project_id` | ref → Project | sim | sim |  |  |
| `title` | string | sim |  |  | 1–200 caracteres |
| `summary` | string | sim |  |  | 1–8000 caracteres |
| `source` | enum | sim |  |  | `cortex`, `chat`, `email`, `meeting`, `other` |
| `external_ref` | string (external_ref) |  |  |  | 1–300 caracteres |
| `participants` | array de objeto |  |  | [] | até 50 itens |
| `participants[].type` | enum | sim |  |  | `user`, `agent`, `system` |
| `participants[].id` | string (actor_id) | sim |  |  | 1–128 caracteres |
| `started_at` | timestamp | sim |  |  |  |
| `ended_at` | timestamp |  |  |  |  |

Regras: `ended_at>=started_at`.

## Memory

Coleção `vault_memories`, id `mem_…`, schemaVersion 1.

| Campo | Tipo | Obrigatório | Imutável | Padrão | Restrições |
|---|---|---|---|---|---|
| `client_id` | ref → Client |  | sim |  |  |
| `project_id` | ref → Project |  | sim |  |  |
| `layer` | enum | sim |  |  | `identity`, `fact`, `decision`, `state`, `preference`, `history`, `derived` |
| `content` | string | sim |  |  | 1–4000 caracteres |
| `status` | enum | sim |  |  | `pending`, `approved`, `rejected`, `expired` |
| `approved_by` | objeto |  |  |  |  |
| `approved_by.type` | enum | sim |  |  | `user`, `agent`, `system` |
| `approved_by.id` | string (actor_id) | sim |  |  | 1–128 caracteres |
| `source_conversation_id` | ref → Conversation |  |  |  |  |
| `expires_at` | timestamp |  |  |  |  |

Pelo menos um de: `client_id`, `project_id`.
Regras: `approved_requires_approved_by`.

## Change

Coleção `vault_changes`, id `chg_…`, schemaVersion 1.

| Campo | Tipo | Obrigatório | Imutável | Padrão | Restrições |
|---|---|---|---|---|---|
| `project_id` | ref → Project | sim | sim |  |  |
| `task_id` | ref → Task |  |  |  |  |
| `repository_id` | ref → Repository |  |  |  |  |
| `kind` | enum | sim |  |  | `code`, `config`, `infra`, `data`, `docs` |
| `summary` | string | sim |  |  | 1–2000 caracteres |
| `branch` | string (branch) |  |  |  | 1–255 caracteres |
| `commit_sha` | sha (40 ou 64 hex) |  |  |  |  |
| `files` | array de string (repo_path) |  |  | [] | até 500 itens |
| `pr_url` | url (https; http só em localhost) |  |  |  |  |
| `status` | enum | sim |  |  | `proposed`, `applied`, `reverted` |

## TestRun

Coleção `vault_test_runs`, id `trn_…`, schemaVersion 1.

| Campo | Tipo | Obrigatório | Imutável | Padrão | Restrições |
|---|---|---|---|---|---|
| `project_id` | ref → Project | sim | sim |  |  |
| `environment_id` | ref → Environment |  |  |  |  |
| `change_id` | ref → Change |  |  |  |  |
| `suite` | string | sim |  |  | 1–200 caracteres |
| `status` | enum | sim |  |  | `running`, `passed`, `failed`, `error`, `skipped` |
| `started_at` | timestamp | sim |  |  |  |
| `duration_ms` | int |  |  |  | 0–604800000 |
| `totals` | objeto |  |  |  |  |
| `totals.passed` | int | sim |  |  | 0–∞ |
| `totals.failed` | int | sim |  |  | 0–∞ |
| `totals.skipped` | int | sim |  |  | 0–∞ |
| `commit_sha` | sha (40 ou 64 hex) |  |  |  |  |
| `evidence_url` | url (https; http só em localhost) |  |  |  |  |

## Deployment

Coleção `vault_deployments`, id `dpl_…`, schemaVersion 1.

| Campo | Tipo | Obrigatório | Imutável | Padrão | Restrições |
|---|---|---|---|---|---|
| `project_id` | ref → Project | sim | sim |  |  |
| `environment_id` | ref → Environment | sim | sim |  |  |
| `release` | string | sim |  |  | 1–100 caracteres |
| `commit_sha` | sha (40 ou 64 hex) | sim |  |  |  |
| `provider` | enum | sim |  |  | `render`, `firebase`, `cloudflare`, `vercel`, `netlify`, `github_pages`, `local`, `other` |
| `status` | enum | sim |  |  | `pending`, `in_progress`, `succeeded`, `failed`, `rolled_back` |
| `started_at` | timestamp | sim |  |  |  |
| `finished_at` | timestamp |  |  |  |  |
| `url` | url (https; http só em localhost) |  |  |  |  |
| `approved_by` | objeto |  |  |  |  |
| `approved_by.type` | enum | sim |  |  | `user`, `agent`, `system` |
| `approved_by.id` | string (actor_id) | sim |  |  | 1–128 caracteres |

Regras: `finished_at>=started_at`.

## Error

Coleção `vault_errors`, id `err_…`, schemaVersion 1.

| Campo | Tipo | Obrigatório | Imutável | Padrão | Restrições |
|---|---|---|---|---|---|
| `project_id` | ref → Project | sim | sim |  |  |
| `kind` | enum | sim |  |  | `tool`, `build`, `test`, `runtime`, `deploy`, `integration`, `other` |
| `severity` | enum | sim |  |  | `low`, `medium`, `high`, `critical` |
| `message` | string | sim |  |  | 1–2000 caracteres |
| `context` | string |  |  |  | 1–4000 caracteres |
| `occurrences` | int |  |  | 1 | 1–∞ |
| `first_seen_at` | timestamp | sim |  |  |  |
| `last_seen_at` | timestamp | sim |  |  |  |
| `status` | enum | sim |  |  | `open`, `investigating`, `resolved`, `ignored` |
| `resolution` | string |  |  |  | 1–4000 caracteres |
| `deployment_id` | ref → Deployment |  |  |  |  |
| `test_run_id` | ref → TestRun |  |  |  |  |

Regras: `last_seen_at>=first_seen_at`, `resolved_requires_resolution`.

## Integration

Coleção `vault_integrations`, id `int_…`, schemaVersion 1.

| Campo | Tipo | Obrigatório | Imutável | Padrão | Restrições |
|---|---|---|---|---|---|
| `project_id` | ref → Project | sim | sim |  |  |
| `provider` | enum | sim | sim |  | `github`, `firebase`, `cloudflare`, `render`, `local`, `other` |
| `status` | enum | sim |  |  | `pending`, `active`, `disabled`, `error` |
| `external_ref` | string (external_ref) |  |  |  | 1–300 caracteres |
| `repository_id` | ref → Repository |  |  |  |  |
| `environment_id` | ref → Environment |  |  |  |  |
| `secret_refs` | array de objeto |  |  | [] | até 50 itens |
| `secret_refs[].name` | string (env_var_name) | sim |  |  | 1–128 caracteres |
| `secret_refs[].store` | enum | sim |  |  | `env`, `render`, `github_actions`, `gcp_secret_manager`, `firebase`, `cloudflare`, `vercel`, `netlify`, `local_env_file`, `other` |
| `secret_refs[].ref` | string (secret_store_path) |  |  |  | 1–256 caracteres |
| `secret_refs[].description` | string |  |  |  | 1–300 caracteres |
| `notes` | string |  |  |  | 1–2000 caracteres |

## ProjectSnapshot

Coleção `vault_project_snapshots`, id `snp_…`, schemaVersion 1.

| Campo | Tipo | Obrigatório | Imutável | Padrão | Restrições |
|---|---|---|---|---|---|
| `project_id` | ref → Project | sim | sim |  |  |
| `generated_at` | timestamp | sim |  |  |  |
| `stack` | array de string |  |  | [] | até 50 itens |
| `frameworks` | array de string |  |  | [] | até 50 itens |
| `directory_structure` | array de string |  |  | [] | até 300 itens |
| `commands` | objeto |  |  |  |  |
| `commands.dev` | string |  |  |  | 1–300 caracteres |
| `commands.test` | string |  |  |  | 1–300 caracteres |
| `commands.build` | string |  |  |  | 1–300 caracteres |
| `commands.start` | string |  |  |  | 1–300 caracteres |
| `repository_id` | ref → Repository |  |  |  |  |
| `default_branch` | string (branch) |  |  |  | 1–255 caracteres |
| `environment_ids` | array de ref → Environment |  |  | [] | até 20 itens, sem repetição |
| `deploy_target` | enum |  |  |  | `render`, `firebase`, `cloudflare`, `vercel`, `netlify`, `github_pages`, `local`, `other` |
| `firebase_project` | string (firebase_project_id) |  |  |  | 1–100 caracteres |
| `cloudflare_ref` | string (external_ref) |  |  |  | 1–200 caracteres |
| `architecture` | string |  |  |  | 1–4000 caracteres |
| `patterns` | array de string |  |  | [] | até 50 itens |
| `last_deployment_id` | ref → Deployment |  |  |  |  |
| `recent_error_ids` | array de ref → Error |  |  | [] | até 20 itens, sem repetição |
| `open_task_ids` | array de ref → Task |  |  | [] | até 50 itens, sem repetição |
| `key_decision_ids` | array de ref → Decision |  |  | [] | até 30 itens, sem repetição |

## ToolCall

Coleção `vault_tool_calls`, id `tcl_…`, schemaVersion 1.

| Campo | Tipo | Obrigatório | Imutável | Padrão | Restrições |
|---|---|---|---|---|---|
| `project_id` | ref → Project | sim | sim |  |  |
| `environment` | enum |  | sim |  | `development`, `staging`, `production`, `preview` |
| `tool` | string (tool_name) | sim | sim |  | 1–100 caracteres |
| `risk` | enum | sim | sim |  | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| `decision` | enum | sim | sim |  | `auto`, `confirm`, `forbidden` |
| `decision_reason` | string | sim | sim |  | 1–300 caracteres |
| `status` | enum | sim |  |  | `pending_approval`, `running`, `succeeded`, `failed`, `rejected`, `denied`, `expired` |
| `requested_by` | objeto | sim | sim |  |  |
| `requested_by.type` | enum | sim |  |  | `user`, `agent`, `system` |
| `requested_by.id` | string (actor_id) | sim |  |  | 1–128 caracteres |
| `requested_at` | timestamp | sim | sim |  |  |
| `decided_by` | objeto |  |  |  |  |
| `decided_by.type` | enum | sim |  |  | `user`, `agent`, `system` |
| `decided_by.id` | string (actor_id) | sim |  |  | 1–128 caracteres |
| `decided_at` | timestamp |  |  |  |  |
| `input_summary` | string |  |  |  | 1–500 caracteres |
| `input_sha256` | sha (64 hex) | sim | sim |  |  |
| `output_summary` | string |  |  |  | 1–2000 caracteres |
| `error_code` | string (error_code) |  |  |  | 1–64 caracteres |
| `duration_ms` | int |  |  |  | 0–86400000 |
| `execution_id` | string (execution_id) |  | sim |  | 1–128 caracteres |

Regras: `pending_requires_confirm`, `denied_requires_forbidden`, `decided_at>=requested_at`.

## ToolPolicy

Coleção `vault_tool_policies`, id `pol_…`, schemaVersion 1.

| Campo | Tipo | Obrigatório | Imutável | Padrão | Restrições |
|---|---|---|---|---|---|
| `project_id` | ref → Project | sim | sim |  |  |
| `rules` | array de objeto |  |  | [] | até 100 itens |
| `rules[].tool` | string (tool_pattern) | sim |  |  | 1–100 caracteres |
| `rules[].environment` | enum |  |  |  | `development`, `staging`, `production`, `preview` |
| `rules[].decision` | enum | sim |  |  | `auto`, `confirm`, `forbidden` |
| `notes` | string |  |  |  | 1–2000 caracteres |

Únicos por tenant: `project_id`.

## Execution

Coleção `vault_executions`, id `exe_…`, schemaVersion 1.

| Campo | Tipo | Obrigatório | Imutável | Padrão | Restrições |
|---|---|---|---|---|---|
| `project_id` | ref → Project | sim | sim |  |  |
| `client_id` | ref → Client |  |  |  |  |
| `conversation_id` | ref → Conversation |  |  |  |  |
| `execution_id` | string (execution_id) | sim | sim |  | 1–128 caracteres |
| `requested_by` | objeto | sim | sim |  |  |
| `requested_by.type` | enum | sim |  |  | `user`, `agent`, `system` |
| `requested_by.id` | string (actor_id) | sim |  |  | 1–128 caracteres |
| `request_summary` | string | sim |  |  | 1–500 caracteres |
| `intent` | enum | sim |  |  | `question`, `status`, `change`, `review`, `pipeline`, `deploy_staging`, `deploy_production`, `unknown` |
| `status` | enum | sim |  |  | `planned`, `running`, `waiting_approval`, `needs_input`, `succeeded`, `failed`, `cancelled` |
| `plan` | array de objeto |  |  | [] | até 20 itens |
| `plan[].step` | int | sim |  |  | 1–50 |
| `plan[].agent` | enum | sim |  |  | `orchestrator`, `architect`, `coder`, `frontend`, `backend`, `database`, `qa`, `security`, `devops`, `reviewer` |
| `plan[].goal` | string | sim |  |  | 1–300 caracteres |
| `plan[].status` | enum | sim |  |  | `pending`, `running`, `done`, `failed`, `skipped`, `waiting_approval` |
| `plan[].model` | string |  |  |  | 1–100 caracteres |
| `plan[].tool_call_ids` | array de ref → ToolCall |  |  | [] | até 50 itens |
| `plan[].attempts` | int |  |  |  | 0–10 |
| `plan[].error_code` | string (error_code) |  |  |  | 1–64 caracteres |
| `plan[].summary` | string |  |  |  | 1–2000 caracteres |
| `gates` | array de objeto |  |  | [] | até 11 itens |
| `gates[].gate` | int | sim |  |  | 1–11 |
| `gates[].name` | string | sim |  |  | 1–100 caracteres |
| `gates[].status` | enum | sim |  |  | `passed`, `failed`, `pending`, `not_applicable` |
| `gates[].evidence` | string |  |  |  | 1–300 caracteres |
| `budget` | objeto |  |  |  |  |
| `budget.max_steps` | int |  |  |  | 0–200 |
| `budget.max_tool_calls` | int |  |  |  | 0–500 |
| `budget.max_tokens` | int |  |  |  | 0–10000000 |
| `budget.max_ms` | int |  |  |  | 0–86400000 |
| `usage` | objeto |  |  |  |  |
| `usage.tool_calls` | int |  |  |  | 0–∞ |
| `usage.input_tokens` | int |  |  |  | 0–∞ |
| `usage.output_tokens` | int |  |  |  | 0–∞ |
| `usage.cost_usd_micros` | int |  |  |  | 0–∞ |
| `usage.cost_known` | bool |  |  |  |  |
| `usage.duration_ms` | int |  |  |  | 0–∞ |
| `models` | array de string |  |  | [] | até 20 itens, sem repetição |
| `work_branch` | string (work_branch) |  |  |  | 1–255 caracteres |
| `pull_request` | int |  |  |  | 1–100000000 |
| `deployment_id` | ref → Deployment |  |  |  |  |
| `review_verdict` | enum |  |  |  | `approve`, `changes_requested` |
| `security_verdict` | enum |  |  |  | `approve`, `changes_requested` |
| `question` | string |  |  |  | 1–2000 caracteres |
| `result_summary` | string |  |  |  | 1–4000 caracteres |
| `error_code` | string (error_code) |  |  |  | 1–64 caracteres |
| `started_at` | timestamp | sim | sim |  |  |
| `finished_at` | timestamp |  |  |  |  |

Únicos por tenant: `execution_id`.
Regras: `finished_at>=started_at`, `needs_input_requires_question`, `final_requires_finished_at`.
