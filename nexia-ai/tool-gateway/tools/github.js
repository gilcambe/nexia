'use strict';
// Ferramentas de leitura do GitHub (risco LOW). Só alcançam repositórios cadastrados no
// Vault para o projeto da chamada: owner/repo nunca vêm da entrada.
// Token: GITHUB_TOKEN do ambiente, se houver (repositório público funciona sem).
const { GatewayError, CODES } = require('../errors');

const API = 'https://api.github.com';
const REF_RE = /^(?!.*\.\.)[A-Za-z0-9._/-]{1,255}$/;
const REPO_ID = { type: 'string' };

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

async function gh({ fetchImpl, env }, path) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'nexia-ai-tool-gateway', 'X-GitHub-Api-Version': '2022-11-28' };
  if (env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  let res;
  try { res = await fetchImpl(`${API}${path}`, { headers, signal: AbortSignal.timeout(20000) }); }
  catch { throw new GatewayError(CODES.UPSTREAM, 'GitHub indisponível.'); }
  if (res.status === 404) throw new GatewayError(CODES.UPSTREAM_NOT_FOUND, 'Não encontrado no GitHub (ou sem acesso).');
  if (!res.ok) throw new GatewayError(CODES.UPSTREAM, `GitHub respondeu ${res.status}.`, { status: res.status });
  return res.json();
}

const enc = s => s.split('/').map(encodeURIComponent).join('/');

module.exports = [
  {
    name: 'github.get_repo', risk: 'LOW',
    description: 'Dados públicos do repositório GitHub do projeto (branch padrão, visibilidade, último push).',
    input_schema: { type: 'object', properties: { repository_id: REPO_ID } },
    summarizeInput: () => 'repositório do projeto',
    async run(deps, i) {
      const repo = await repoFor(deps, i.repository_id);
      const d = await gh(deps, `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}`);
      return { full_name: d.full_name, default_branch: d.default_branch, visibility: d.private ? 'private' : 'public', archived: !!d.archived,
        open_issues_count: d.open_issues_count, pushed_at: d.pushed_at, html_url: d.html_url };
    },
    summarizeOutput: r => `${r.full_name} (${r.visibility}, branch ${r.default_branch})`,
  },
  {
    name: 'github.get_checks', risk: 'LOW',
    description: 'Check runs de um ref (branch, tag ou commit) do repositório GitHub do projeto.',
    input_schema: { type: 'object', properties: { repository_id: REPO_ID, ref: { type: 'string' } } },
    summarizeInput: i => `ref ${i.ref ? String(i.ref).replace(/^([0-9a-f]{7})[0-9a-f]{33,}$/i, '$1…') : '(branch padrão)'}`,
    async run(deps, i) {
      const repo = await repoFor(deps, i.repository_id);
      const ref = i.ref || repo.default_branch;
      if (!REF_RE.test(ref)) throw new GatewayError(CODES.INVALID_INPUT, 'ref inválido.');
      const d = await gh(deps, `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/commits/${enc(ref)}/check-runs?per_page=100`);
      const runs = (d.check_runs || []).map(r => ({ name: r.name, status: r.status, conclusion: r.conclusion }));
      const by = {};
      for (const r of runs) { const k = r.conclusion || r.status; by[k] = (by[k] || 0) + 1; }
      return { repository: `${repo.owner}/${repo.repo}`, ref, total: d.total_count ?? runs.length, by_conclusion: by, runs: runs.slice(0, 50) };
    },
    summarizeOutput: r => `${r.repository}: ${r.total} check(s) (${Object.entries(r.by_conclusion).map(([k, v]) => `${k} ${v}`).join(', ') || 'nenhum'})`,
  },
];
