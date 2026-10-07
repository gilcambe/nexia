'use strict';
// GitHub Adapter (spec §9, Fase 8 do MIGRATION-PLAN). Operações sobre UM repositório
// cadastrado no Vault; quem escolhe o repositório é o Tool Gateway (owner/repo nunca vêm
// da entrada do agente).
//
// Regras de escrita (valem para qualquer autonomia):
//  - só em branches com prefixo "nexia/" e nunca na branch padrão: o agente não escreve
//    direto em main/develop; o caminho para a branch padrão é sempre um PR;
//  - commit só por fast-forward (sem force), opcionalmente condicionado ao SHA esperado;
//  - nada de arquivo sensível (.env, chaves, credenciais) nem conteúdo com forma de secret;
//  - commit não apaga arquivo (exclusão é CRITICAL na spec §15);
//  - workflow_dispatch não roda workflow de deploy/produção (Fases 9 e 11).
const { createAuth } = require('./auth');
const { isSensitivePath, findSecrets, redactSecrets } = require('./guards');
const { GatewayError, CODES } = require('../tool-gateway/errors');

const API = 'https://api.github.com';
const REF_RE = /^(?!.*\.\.)(?!.*\/\/)(?!\/)(?!.*\/$)(?!.*\.lock$)[A-Za-z0-9._/-]{1,200}$/;
const WORK_BRANCH_RE = /^nexia\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/;
const SHA_RE = /^[0-9a-f]{40}$/;
const PATH_RE = /^(?![/\\])(?!.*(?:^|\/)\.\.?(?:\/|$))(?!.*\/\/)[^\0\\:*?"<>|]{1,400}$/;
const WORKFLOW_RE = /^[A-Za-z0-9._-]{1,100}\.ya?ml$/;
const DEPLOY_WORKFLOW_RE = /deploy|prod|release|publish/i;
const PIPELINE_WORKFLOW = 'nexia-pipeline.yml'; // pipeline modelo da Fase 9: só deploy.* dispara
const LIMITS = Object.freeze({ files: 20, edits: 40, fileBytes: 256 * 1024, totalBytes: 600 * 1024, readBytes: 512 * 1024, message: 1000, prBody: 20000 });

const PERMS = Object.freeze({
  read: { metadata: 'read', contents: 'read' },
  readChecks: { metadata: 'read', checks: 'read' },
  readIssues: { metadata: 'read', issues: 'read' },
  readPulls: { metadata: 'read', pull_requests: 'read' },
  readActions: { metadata: 'read', actions: 'read' },
  writeContents: { metadata: 'read', contents: 'write' },
  writePulls: { metadata: 'read', pull_requests: 'write' },
  writeActions: { metadata: 'read', actions: 'write' },
});

const enc = s => String(s).split('/').map(encodeURIComponent).join('/');
const bad = msg => new GatewayError(CODES.INVALID_INPUT, msg);

function checkRef(ref, what = 'ref') {
  if (typeof ref !== 'string' || !REF_RE.test(ref)) throw bad(`${what} inválido.`);
  return ref;
}
function checkWorkBranch(repo, branch) {
  checkRef(branch, 'branch');
  if (!WORK_BRANCH_RE.test(branch)) throw new GatewayError(CODES.FORBIDDEN, 'O NEXIA só escreve em branches "nexia/...". Para chegar à branch padrão, abra um PR.');
  if (branch === repo.default_branch) throw new GatewayError(CODES.FORBIDDEN, 'O NEXIA não escreve na branch padrão.');
  return branch;
}
function checkPath(p) {
  if (typeof p !== 'string' || !PATH_RE.test(p) || p.split('/').includes('.git')) throw bad('Caminho de arquivo inválido.');
  if (isSensitivePath(p)) throw new GatewayError(CODES.SENSITIVE_FILE, 'Arquivo sensível (.env, chave, credencial) não é lido nem escrito pelo NEXIA.');
  return p;
}
function checkText(text, what) {
  const hits = findSecrets(text);
  if (hits.length) throw new GatewayError(CODES.SECRET_IN_CONTENT, `${what} parece conter um secret (${hits.join(', ')}); use variável de ambiente ou secret store.`);
}

/**
 * @param {{ repo: { owner, repo, default_branch? }, env?, fetchImpl?, apiBase?, now?, auth? }} o
 */
/** Acha `find` em `text` ignorando diferenças de espaço em branco; só vale se houver exatamente 1 ocorrência. */
function looseFind(text, find) {
  const tokens = String(find).split(/\s+/).filter(Boolean);
  if (!tokens.length || tokens.length > 4000) return null;
  const re = new RegExp(tokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+'), 'g');
  const found = [];
  for (let m; (m = re.exec(text)) && found.length < 2;) found.push({ start: m.index, end: m.index + m[0].length });
  return found.length === 1 ? found[0] : null;
}

function createGithubAdapter(o) {
  const repo = o.repo;
  const apiBase = o.apiBase || API;
  const fetchImpl = o.fetchImpl || ((...a) => fetch(...a));
  const auth = o.auth || createAuth({ env: o.env || process.env, fetchImpl, apiBase, now: o.now });
  const base = `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}`;

  async function call(method, path, { body, write = false, permissions = PERMS.read, accept } = {}) {
    const headers = { Accept: accept || 'application/vnd.github+json', 'User-Agent': 'nexia-ai-github-adapter', 'X-GitHub-Api-Version': '2022-11-28',
      ...(await auth.headersFor(repo, { write, permissions })), ...(body ? { 'Content-Type': 'application/json' } : {}) };
    let r;
    try { r = await fetchImpl(`${apiBase}${base}${path}`, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) }); }
    catch { throw new GatewayError(CODES.UPSTREAM, 'GitHub indisponível.'); }
    if (r.status === 204) return null;
    if (r.status === 404) throw new GatewayError(CODES.UPSTREAM_NOT_FOUND, 'Não encontrado no GitHub (ou sem acesso).');
    if (r.status === 409 || r.status === 422) {
      // Mensagem curta do GitHub (ex.: "Reference already exists"); nunca dados da requisição.
      let msg = '';
      try { msg = String((await r.json()).message || '').replace(/[^\w .,'"()-]/g, '').slice(0, 120); } catch { /* sem corpo */ }
      throw new GatewayError(CODES.CONFLICT, `GitHub recusou a operação (${r.status}${msg ? `: ${msg}` : ''}).`, { status: r.status });
    }
    if (!r.ok) throw new GatewayError(CODES.UPSTREAM, `GitHub respondeu ${r.status}.`, { status: r.status });
    return accept && accept.includes('diff') ? r.text() : r.json();
  }

  // Escrita sem GitHub App falha antes de qualquer chamada ao GitHub.
  const requireWrite = () => { if (auth.mode !== 'app') throw new GatewayError(CODES.GITHUB_APP_REQUIRED, 'Escrever no GitHub exige a GitHub App do NEXIA configurada (GITHUB_APP_ID e GITHUB_APP_PRIVATE_KEY).'); };

  let defaultBranch = repo.default_branch || null;
  async function getDefaultBranch() {
    if (!defaultBranch) defaultBranch = (await call('GET', '')).default_branch;
    return defaultBranch;
  }

  async function headOf(branch) {
    const d = await call('GET', `/git/ref/heads/${enc(branch)}`);
    return d.object.sha;
  }

  const api = {
    repo, auth,
    async getRepo() {
      const d = await call('GET', '');
      defaultBranch = d.default_branch;
      return { full_name: d.full_name, default_branch: d.default_branch, visibility: d.private ? 'private' : 'public', archived: !!d.archived,
        open_issues_count: d.open_issues_count, pushed_at: d.pushed_at, html_url: d.html_url };
    },

    async listBranches({ limit = 100 } = {}) {
      const d = await call('GET', `/branches?per_page=${Math.min(Math.max(limit, 1), 100)}`);
      return d.map(b => ({ name: b.name, sha: b.commit && b.commit.sha, protected: !!b.protected }));
    },

    async getFile({ path, ref }) {
      checkPath(path);
      if (ref !== undefined) checkRef(ref);
      const d = await call('GET', `/contents/${enc(path)}${ref ? `?ref=${encodeURIComponent(ref)}` : ''}`);
      if (Array.isArray(d) || d.type !== 'file') throw bad('O caminho não é um arquivo.');
      if (d.size > LIMITS.readBytes || d.encoding !== 'base64') throw bad(`Arquivo grande demais para ler pelo NEXIA (limite ${LIMITS.readBytes / 1024} KB).`);
      const text = Buffer.from(d.content, 'base64').toString('utf8');
      const r = redactSecrets(text);
      return { path: d.path, sha: d.sha, size: d.size, content: r.text, redactions: r.count };
    },

    async compare({ base: from, head }) {
      checkRef(from, 'base'); checkRef(head, 'head');
      const d = await call('GET', `/compare/${enc(from)}...${enc(head)}`);
      const files = (d.files || []).slice(0, 300).map(f => {
        const sensitive = isSensitivePath(f.filename);
        return { path: f.filename, status: f.status, additions: f.additions, deletions: f.deletions,
          ...(sensitive ? { sensitive: true } : f.patch ? { patch: redactSecrets(f.patch.slice(0, 20000)).text } : {}) };
      });
      return { status: d.status, ahead_by: d.ahead_by, behind_by: d.behind_by, total_commits: d.total_commits,
        commits: (d.commits || []).slice(-50).map(c => ({ sha: c.sha, message: redactSecrets(c.commit.message.split('\n')[0]).text })), files };
    },

    async listCommits({ ref, path, limit = 30 } = {}) {
      const q = new URLSearchParams({ per_page: String(Math.min(Math.max(limit, 1), 100)) });
      if (ref !== undefined) q.set('sha', checkRef(ref));
      if (path !== undefined) q.set('path', checkPath(path));
      const d = await call('GET', `/commits?${q}`);
      return d.map(c => ({ sha: c.sha, message: redactSecrets(c.commit.message.split('\n')[0]).text, author: c.commit.author && c.commit.author.name, date: c.commit.author && c.commit.author.date }));
    },

    async listIssues({ state = 'open', limit = 30 } = {}) {
      if (!['open', 'closed', 'all'].includes(state)) throw bad('state inválido.');
      const d = await call('GET', `/issues?state=${state}&per_page=${Math.min(Math.max(limit, 1), 100)}`, { permissions: PERMS.readIssues });
      return d.filter(i => !i.pull_request).map(i => ({ number: i.number, title: redactSecrets(i.title).text, state: i.state, labels: (i.labels || []).map(l => l.name), updated_at: i.updated_at, html_url: i.html_url }));
    },

    async listPulls({ state = 'open', limit = 30 } = {}) {
      if (!['open', 'closed', 'all'].includes(state)) throw bad('state inválido.');
      const d = await call('GET', `/pulls?state=${state}&per_page=${Math.min(Math.max(limit, 1), 100)}`, { permissions: PERMS.readPulls });
      return d.map(p => ({ number: p.number, title: redactSecrets(p.title).text, state: p.state, draft: !!p.draft, head: p.head.ref, base: p.base.ref, merged_at: p.merged_at, html_url: p.html_url }));
    },

    async getChecks({ ref }) {
      const r = checkRef(ref || await getDefaultBranch());
      const d = await call('GET', `/commits/${enc(r)}/check-runs?per_page=100`, { permissions: PERMS.readChecks });
      const runs = (d.check_runs || []).map(c => ({ name: c.name, status: c.status, conclusion: c.conclusion }));
      const by = {};
      for (const c of runs) { const k = c.conclusion || c.status; by[k] = (by[k] || 0) + 1; }
      return { ref: r, total: d.total_count ?? runs.length, by_conclusion: by, runs: runs.slice(0, 50) };
    },

    async listWorkflowRuns({ branch, limit = 20 } = {}) {
      const q = new URLSearchParams({ per_page: String(Math.min(Math.max(limit, 1), 50)) });
      if (branch !== undefined) q.set('branch', checkRef(branch, 'branch'));
      const d = await call('GET', `/actions/runs?${q}`, { permissions: PERMS.readActions });
      return (d.workflow_runs || []).map(w => ({ id: w.id, name: w.name, event: w.event, branch: w.head_branch, sha: w.head_sha, status: w.status, conclusion: w.conclusion, created_at: w.created_at, html_url: w.html_url }));
    },

    /** Cria "nexia/..." a partir da branch padrão (ou de outro ref existente). */
    async createBranch({ branch, from }) {
      requireWrite();
      checkWorkBranch({ default_branch: await getDefaultBranch() }, branch);
      const source = checkRef(from || await getDefaultBranch(), 'from');
      const sha = SHA_RE.test(source) ? source : await headOf(source);
      await call('POST', '/git/refs', { body: { ref: `refs/heads/${branch}`, sha }, write: true, permissions: PERMS.writeContents });
      return { branch, sha, from: source };
    },

    /**
     * Um commit com vários arquivos (Git Data API), por fast-forward.
     * @param {{ branch, message, files: { path, content }[], expected_head_sha? }} i
     */
    async commitFiles({ branch, message, files, expected_head_sha }) {
      requireWrite();
      checkWorkBranch({ default_branch: await getDefaultBranch() }, branch);
      if (typeof message !== 'string' || !message.trim() || message.length > LIMITS.message) throw bad('Mensagem de commit inválida.');
      checkText(message, 'A mensagem');
      if (!Array.isArray(files) || !files.length || files.length > LIMITS.files) throw bad(`Envie de 1 a ${LIMITS.files} arquivos.`);
      const seen = new Set();
      let total = 0;
      for (const f of files) {
        checkPath(f.path);
        if (seen.has(f.path)) throw bad('Arquivo repetido no commit.');
        seen.add(f.path);
        if (typeof f.content !== 'string') throw bad('content deve ser texto.');
        const n = Buffer.byteLength(f.content, 'utf8');
        if (n > LIMITS.fileBytes) throw bad(`Arquivo acima de ${LIMITS.fileBytes / 1024} KB.`);
        total += n;
        checkText(f.content, `O arquivo ${f.path}`);
      }
      if (total > LIMITS.totalBytes) throw bad(`Commit acima de ${LIMITS.totalBytes / 1024} KB.`);
      if (expected_head_sha !== undefined && !SHA_RE.test(expected_head_sha)) throw bad('expected_head_sha inválido.');

      const w = { write: true, permissions: PERMS.writeContents };
      const head = await headOf(branch);
      if (expected_head_sha && expected_head_sha !== head) throw new GatewayError(CODES.CONFLICT, 'A branch andou desde o pedido; leia de novo e refaça o commit.', { head });
      const parent = await call('GET', `/git/commits/${head}`);
      const tree = await call('POST', '/git/trees', { ...w, body: { base_tree: parent.tree.sha, tree: files.map(f => ({ path: f.path, mode: '100644', type: 'blob', content: f.content })) } });
      const commit = await call('POST', '/git/commits', { ...w, body: { message, tree: tree.sha, parents: [head] } });
      await call('PATCH', `/git/refs/heads/${enc(branch)}`, { ...w, body: { sha: commit.sha, force: false } });
      return { branch, commit: commit.sha, parent: head, files: files.map(f => f.path) };
    },

    /** PR de uma branch "nexia/..." para a branch padrão (ou outra não "nexia/"); rascunho por padrão. */
    async createPull({ head, base: target, title, body = '', draft = true }) {
      requireWrite();
      const def = await getDefaultBranch();
      checkWorkBranch({ default_branch: def }, head);
      const into = checkRef(target || def, 'base');
      if (into === head) throw bad('base e head iguais.');
      if (typeof title !== 'string' || !title.trim() || title.length > 256) throw bad('Título inválido.');
      if (typeof body !== 'string' || body.length > LIMITS.prBody) throw bad('Descrição grande demais.');
      checkText(`${title}\n${body}`, 'O PR');
      const d = await call('POST', '/pulls', { body: { title, head, base: into, body, draft: draft !== false }, write: true, permissions: PERMS.writePulls });
      return { number: d.number, html_url: d.html_url, head, base: into, draft: !!d.draft, state: d.state };
    },

    /** workflow_dispatch de um workflow que não seja de deploy, numa branch "nexia/..." ou na padrão. */
    async dispatchWorkflow({ workflow, ref, inputs = {} }) {
      requireWrite();
      if (typeof workflow !== 'string' || !WORKFLOW_RE.test(workflow)) throw bad('workflow deve ser o nome do arquivo (ex.: ci.yml).');
      if (DEPLOY_WORKFLOW_RE.test(workflow) || workflow === PIPELINE_WORKFLOW) throw new GatewayError(CODES.FORBIDDEN, 'Workflow de deploy/produção não é disparado por esta ferramenta (use deploy.staging; produção na Fase 11).');
      const def = await getDefaultBranch();
      const r = checkRef(ref || def);
      if (r !== def && !WORK_BRANCH_RE.test(r)) throw new GatewayError(CODES.FORBIDDEN, 'Só a branch padrão ou branches "nexia/...".');
      const keys = Object.keys(inputs);
      if (keys.length > 10 || keys.some(k => !/^[A-Za-z0-9_-]{1,50}$/.test(k) || typeof inputs[k] !== 'string' || inputs[k].length > 200)) throw bad('inputs inválidos.');
      if (keys.some(k => DEPLOY_WORKFLOW_RE.test(inputs[k]) || /environment|target|deploy/i.test(k))) throw new GatewayError(CODES.FORBIDDEN, 'inputs de ambiente/deploy não são aceitos por esta ferramenta.');
      checkText(JSON.stringify(inputs), 'Os inputs');
      await call('POST', `/actions/workflows/${encodeURIComponent(workflow)}/dispatches`, { body: { ref: r, inputs }, write: true, permissions: PERMS.writeActions });
      return { workflow, ref: r, dispatched: true };
    },

    /**
     * Pipeline modelo (Fase 9) com target=staging ou, só pela ferramenta deploy.production (CRITICAL, sempre
     * com aprovação humana; Fase 11), target=production. expectedSha: recusa se a branch andou (o commit
     * disparado tem que ser o que passou em staging). Devolve o SHA disparado.
     */
    async dispatchPipeline({ ref, target, allowProduction = false, expectedSha }) {
      requireWrite();
      if (!(target === 'staging' || (target === 'production' && allowProduction === true))) {
        throw new GatewayError(CODES.FORBIDDEN, 'Produção só pela ferramenta deploy.production, com aprovação humana.');
      }
      const r = checkRef(ref || await getDefaultBranch());
      const sha = SHA_RE.test(r) ? r : await headOf(r);
      if (expectedSha && sha !== expectedSha) throw new GatewayError(CODES.CONFLICT, `A branch ${r} mudou (${sha.slice(0, 7)}) desde o commit validado (${String(expectedSha).slice(0, 7)}).`);
      await call('POST', `/actions/workflows/${PIPELINE_WORKFLOW}/dispatches`, { body: { ref: r, inputs: { target } }, write: true, permissions: PERMS.writeActions });
      return { workflow: PIPELINE_WORKFLOW, ref: r, sha, target };
    },

    /** Execução do pipeline modelo disparada para um commit (a mais recente criada a partir de `since`). */
    async findPipelineRun({ sha, since, target }) {
      if (!SHA_RE.test(String(sha))) throw bad('sha inválido.');
      const d = await call('GET', `/actions/workflows/${PIPELINE_WORKFLOW}/runs?event=workflow_dispatch&head_sha=${sha}&per_page=20`, { permissions: PERMS.readActions });
      // display_title vem do run-name do pipeline ("nexia-pipeline target=..."); pipelines antigos sem
      // run-name não dizem o alvo e continuam valendo.
      const other = w => target && /target=(\w+)/.test(w.display_title || '') && RegExp.$1 !== target;
      const runs = (d.workflow_runs || []).filter(w => (!since || Date.parse(w.created_at) >= Date.parse(since) - 60_000) && !other(w))
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
      const w = runs[0];
      return w ? { id: w.id, status: w.status, conclusion: w.conclusion, html_url: w.html_url, created_at: w.created_at, updated_at: w.updated_at } : null;
    },

    // Edição por trechos: lê cada arquivo na ponta da branch, troca cada "find" (que precisa
    // aparecer exatamente uma vez) por "replace" e grava tudo num commit só. Assim o agente não
    // reescreve arquivos inteiros (nem perde o que não leu). Arquivo com segredo redigido não é editado.
    async editFiles({ branch, message, edits }) {
      requireWrite();
      checkWorkBranch({ default_branch: await getDefaultBranch() }, branch);
      if (!Array.isArray(edits) || !edits.length || edits.length > LIMITS.edits) throw bad(`Envie de 1 a ${LIMITS.edits} trechos.`);
      const byPath = new Map();
      for (const e of edits) {
        if (!e || typeof e.find !== 'string' || !e.find || typeof e.replace !== 'string') throw bad('Cada trecho precisa de path, find (não vazio) e replace.');
        checkPath(e.path);
        if (!byPath.has(e.path)) byPath.set(e.path, []);
        byPath.get(e.path).push(e);
      }
      if (byPath.size > LIMITS.files) throw bad(`No máximo ${LIMITS.files} arquivos por commit.`);
      const head = await headOf(branch);
      const files = [];
      for (const [path, list] of byPath) {
        const f = await api.getFile({ path, ref: head });
        if (f.redactions) throw bad(`${path} tem segredo redigido; não pode ser editado pelo NEXIA.`);
        let text = f.content;
        // Modelos grátis escapam aspas (\") dentro do trecho como se fosse JSON: se o arquivo não tem \",
        // desfaz o escape no find e no replace para não gravar barras invertidas no código.
        list.forEach((e0, k) => {
          const e = desescapaAspas(text, e0);
          const n = text.split(e.find).length - 1;
          if (n === 1) { text = text.replace(e.find, () => e.replace); return; }
          // Modelos grátis erram espaço, tab ou quebra de linha ao copiar o trecho: sem cópia exata, aceita
          // o trecho que só difere em espaços em branco, desde que ele apareça uma única vez.
          const loose = n === 0 ? looseFind(text, e.find) : null;
          if (!loose) throw bad(`${path}: o trecho ${k + 1} aparece ${n} vez(es); precisa aparecer exatamente 1 vez (copie o texto exato do arquivo).`);
          text = text.slice(0, loose.start) + e.replace + text.slice(loose.end);
        });
        files.push({ path, content: text });
      }
      return api.commitFiles({ branch, message, files, expected_head_sha: head });
    },
  };
  return api;
}

function desescapaAspas(text, e) {
  if (text.includes('\\"')) return e;
  return { ...e, find: e.find.replace(/\\"/g, '"'), replace: e.replace.replace(/\\"/g, '"') };
}

module.exports = { createGithubAdapter, looseFind, desescapaAspas, LIMITS, WORK_BRANCH_RE, PERMS, PIPELINE_WORKFLOW };
