'use strict';
// Ferramentas do GitHub (spec §9, §13; Fase 8). Só alcançam repositórios cadastrados no
// Vault para o projeto da chamada: owner/repo nunca vêm da entrada. A execução é do
// GitHub Adapter (nexia-ai/github-adapter), que aplica as regras de escrita.
//
// Risco (spec §15) e autonomia mínima (spec §23):
//   leitura (repo, branches, arquivo, diff, histórico, issues, PRs, checks, Actions)  LOW
//   criar branch "nexia/..."                                                MEDIUM  nível 2
//   commit numa branch "nexia/..." (equivale a push)                        HIGH    nível 2
//   abrir PR                                                                HIGH    nível 3
//   workflow_dispatch (nunca de deploy)                                     HIGH    nível 3
const { createGithubAdapter } = require('../../github-adapter');
const { GatewayError, CODES } = require('../errors');

const REPO_ID = { type: 'string' };
const STR = { type: 'string' };
const LIMIT = { type: 'integer', minimum: 1, maximum: 100 };
const STATE = { type: 'string', enum: ['open', 'closed', 'all'] };
const short = s => String(s || '').replace(/^([0-9a-f]{7})[0-9a-f]{33}$/i, '$1…');

async function repoFor({ vault, ctx, project }, repositoryId) {
  let repo;
  if (repositoryId) repo = await vault.Repository.get(ctx, repositoryId);
  else if (project.primary_repository_id) repo = await vault.Repository.get(ctx, project.primary_repository_id);
  else repo = (await vault.Repository.list(ctx, { where: { project_id: project.id }, limit: 1 }))[0];
  if (!repo) throw new GatewayError(CODES.INVALID_INPUT, 'Projeto sem repositório cadastrado.');
  if (repo.project_id !== project.id) throw new GatewayError(CODES.SCOPE, 'Repositório fora do projeto desta chamada.');
  if (repo.provider !== 'github') throw new GatewayError(CODES.INVALID_INPUT, 'Repositório não é do GitHub.');
  return repo;
}

async function adapterFor(deps, repositoryId) {
  const repo = await repoFor(deps, repositoryId);
  const gh = deps.github ? deps.github(repo) : createGithubAdapter({ repo, env: deps.env, fetchImpl: deps.fetchImpl });
  return { repo, gh, full: `${repo.owner}/${repo.repo}` };
}

/** Atalho para declarar uma ferramenta. */
function tool(name, risk, description, properties, required, run, summarizeInput, summarizeOutput, extra = {}) {
  return { name, risk, description, input_schema: { type: 'object', properties: { repository_id: REPO_ID, ...properties }, ...(required ? { required } : {}) },
    summarizeInput, summarizeOutput, ...extra,
    async run(deps, i) { const a = await adapterFor(deps, i.repository_id); return run(a, i); } };
}

module.exports = [
  tool('github.get_repo', 'LOW', 'Dados do repositório GitHub do projeto (branch padrão, visibilidade, último push).', {}, null,
    ({ gh }) => gh.getRepo(),
    () => 'repositório do projeto', r => `${r.full_name} (${r.visibility}, branch ${r.default_branch})`),

  tool('github.get_checks', 'LOW', 'Check runs de um ref (branch, tag ou commit) do repositório GitHub do projeto.', { ref: STR }, null,
    async ({ gh, full }, i) => ({ repository: full, ...(await gh.getChecks(i)) }),
    i => `ref ${i.ref ? short(i.ref) : '(branch padrão)'}`,
    r => `${r.repository}: ${r.total} check(s) (${Object.entries(r.by_conclusion).map(([k, v]) => `${k} ${v}`).join(', ') || 'nenhum'})`),

  tool('github.list_branches', 'LOW', 'Branches do repositório do projeto.', { limit: LIMIT }, null,
    async ({ gh, full }, i) => ({ repository: full, branches: await gh.listBranches(i) }),
    () => 'branches', r => `${r.repository}: ${r.branches.length} branch(es)`),

  tool('github.get_file', 'LOW', 'Lê um arquivo de texto do repositório (até 512 KB; arquivos sensíveis nunca; secrets redigidos).', { path: STR, ref: STR }, ['path'],
    ({ gh }, i) => gh.getFile(i),
    i => `arquivo ${i.path}${i.ref ? ` em ${short(i.ref)}` : ''}`, r => `${r.path} (${r.size} bytes${r.redactions ? `, ${r.redactions} redação(ões)` : ''})`),

  tool('github.compare', 'LOW', 'Diff entre dois refs (base...head): commits e arquivos alterados.', { base: STR, head: STR }, ['base', 'head'],
    ({ gh }, i) => gh.compare(i),
    i => `diff ${short(i.base)}...${short(i.head)}`, r => `${r.status}: ${r.total_commits} commit(s), ${r.files.length} arquivo(s)`),

  tool('github.list_commits', 'LOW', 'Histórico de commits de um ref (opcionalmente de um arquivo).', { ref: STR, path: STR, limit: LIMIT }, null,
    async ({ gh }, i) => ({ commits: await gh.listCommits(i) }),
    i => `histórico${i.ref ? ` de ${short(i.ref)}` : ''}${i.path ? ` (${i.path})` : ''}`, r => `${r.commits.length} commit(s)`),

  tool('github.list_issues', 'LOW', 'Issues do repositório do projeto.', { state: STATE, limit: LIMIT }, null,
    async ({ gh }, i) => ({ issues: await gh.listIssues(i) }),
    i => `issues ${i.state || 'open'}`, r => `${r.issues.length} issue(s)`),

  tool('github.list_pulls', 'LOW', 'Pull requests do repositório do projeto.', { state: STATE, limit: LIMIT }, null,
    async ({ gh }, i) => ({ pulls: await gh.listPulls(i) }),
    i => `PRs ${i.state || 'open'}`, r => `${r.pulls.length} PR(s)`),

  tool('github.list_workflow_runs', 'LOW', 'Execuções recentes do GitHub Actions (opcionalmente de uma branch).', { branch: STR, limit: { type: 'integer', minimum: 1, maximum: 50 } }, null,
    async ({ gh }, i) => ({ runs: await gh.listWorkflowRuns(i) }),
    i => `Actions${i.branch ? ` de ${i.branch}` : ''}`, r => `${r.runs.length} execução(ões)`),

  tool('github.create_branch', 'MEDIUM', 'Cria uma branch "nexia/..." a partir da branch padrão (ou de outro ref).', { branch: STR, from: STR }, ['branch'],
    ({ gh }, i) => gh.createBranch(i),
    i => `criar ${i.branch}${i.from ? ` de ${short(i.from)}` : ''}`, r => `${r.branch} em ${short(r.sha)}`, { min_autonomy: 2 }),

  tool('github.commit_files', 'HIGH', 'Commita arquivos de texto numa branch "nexia/..." (um commit, sem force; nunca na branch padrão; sem exclusão).',
    { branch: STR, message: STR, expected_head_sha: STR,
      files: { type: 'array', minItems: 1, maxItems: 20, items: { type: 'object', properties: { path: STR, content: STR }, required: ['path', 'content'] } } },
    ['branch', 'message', 'files'],
    ({ gh }, i) => gh.commitFiles(i),
    i => `commit em ${i.branch}: ${(i.files || []).length} arquivo(s) (${(i.files || []).slice(0, 5).map(f => f.path).join(', ')})`,
    r => `${r.branch} → ${short(r.commit)} (${r.files.length} arquivo(s))`, { min_autonomy: 2 }),

  tool('github.edit_files', 'HIGH', 'Edita arquivos existentes por trechos numa branch "nexia/..." (um commit): cada "find" precisa aparecer exatamente 1 vez no arquivo e vira "replace". Prefira a reescrever arquivos inteiros.',
    { branch: STR, message: STR,
      edits: { type: 'array', minItems: 1, maxItems: 40, items: { type: 'object', properties: { path: STR, find: STR, replace: STR }, required: ['path', 'find', 'replace'] } } },
    ['branch', 'message', 'edits'],
    ({ gh }, i) => gh.editFiles(i),
    i => `edição em ${i.branch}: ${(i.edits || []).length} trecho(s) (${[...new Set((i.edits || []).map(e => e.path))].slice(0, 5).join(', ')})`,
    r => `${r.branch} → ${short(r.commit)} (${r.files.length} arquivo(s))`, { min_autonomy: 2 }),

  tool('github.create_pr', 'HIGH', 'Abre um pull request (rascunho por padrão) de uma branch "nexia/..." para a branch padrão.',
    { head: STR, base: STR, title: STR, body: STR, draft: { type: 'boolean' } }, ['head', 'title'],
    ({ gh }, i) => gh.createPull(i),
    i => `PR ${i.head} → ${i.base || '(padrão)'}: ${String(i.title || '').slice(0, 80)}`, r => `PR #${r.number} (${r.draft ? 'rascunho' : 'aberto'})`, { min_autonomy: 3 }),

  tool('github.dispatch_workflow', 'HIGH', 'Dispara um workflow do GitHub Actions (workflow_dispatch) que não seja de deploy.',
    { workflow: STR, ref: STR, inputs: { type: 'object' } }, ['workflow'],
    ({ gh }, i) => gh.dispatchWorkflow(i),
    i => `workflow ${i.workflow} em ${i.ref || '(padrão)'}`, r => `${r.workflow} disparado em ${r.ref}`, { min_autonomy: 3 }),
];

module.exports.adapterFor = adapterFor;
