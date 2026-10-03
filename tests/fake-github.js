'use strict';
// GitHub falso em memória para os testes da Fase 8: implementa o pedaço da REST API que o
// GitHub Adapter usa (App → token de instalação, refs, Git Data API, contents, PRs,
// workflow_dispatch). É um fetchImpl: nada sai da máquina.
const crypto = require('crypto');

const sha1 = s => crypto.createHash('sha1').update(s).digest('hex');
const json = (status, body) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function createFakeGithub({ owner = 'gilcambe', repo = 'nexia', appId = '424242', installationId = 777, files = { 'README.md': '# nexia\n', 'src/app.js': 'console.log(1);\n' } } = {}) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const privatePem = privateKey.export({ type: 'pkcs1', format: 'pem' });
  const commits = new Map();
  const branches = new Map();
  const pulls = [];
  const dispatches = [];
  const runs = []; // execuções do Actions criadas por workflow_dispatch
  const checks = new Map(); // ref (branch ou sha) → [{ name, status, conclusion }]
  const issued = new Map(); // token → { repositories, permissions }
  const calls = [];
  let n = 0;

  function addCommit(tree, parents, message) {
    const sha = sha1(`${++n}:${message}:${JSON.stringify(tree)}`);
    commits.set(sha, { sha, tree: { ...tree }, treeSha: sha1(`tree:${sha}`), parents, message });
    return sha;
  }
  const trees = new Map();
  const root = addCommit(files, [], 'inicial');
  trees.set(commits.get(root).treeSha, commits.get(root).tree);
  branches.set('develop', root);
  branches.set('main', root);

  function verifyJwt(auth) {
    const t = String(auth || '').replace(/^Bearer /, '');
    const [h, p, s] = t.split('.');
    if (!s) return false;
    const ok = crypto.verify('RSA-SHA256', Buffer.from(`${h}.${p}`), publicKey, Buffer.from(s, 'base64url'));
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
    return ok && payload.iss === appId && payload.exp > Date.now() / 1000;
  }

  async function fetchImpl(url, opts = {}) {
    const u = new URL(url);
    const method = opts.method || 'GET';
    const auth = (opts.headers || {}).Authorization;
    const body = opts.body ? JSON.parse(opts.body) : undefined;
    const p = decodeURIComponent(u.pathname);
    calls.push({ method, path: u.pathname + u.search, auth: auth ? (issued.has(auth.replace('Bearer ', '')) ? 'installation' : 'other') : 'none', body });

    if (u.host !== 'api.github.com') return json(599, { message: 'host inesperado' });
    if (method === 'GET' && p === `/repos/${owner}/${repo}/installation`) return verifyJwt(auth) ? json(200, { id: installationId }) : json(401, { message: 'Bad credentials' });
    if (method === 'POST' && p === `/app/installations/${installationId}/access_tokens`) {
      if (!verifyJwt(auth)) return json(401, { message: 'Bad credentials' });
      const token = `ghs_${crypto.randomBytes(18).toString('hex')}`;
      issued.set(token, { repositories: body.repositories, permissions: body.permissions });
      return json(201, { token, expires_at: new Date(Date.now() + 3600e3).toISOString() });
    }
    const base = `/repos/${owner}/${repo}`;
    if (!p.startsWith(base)) return json(404, { message: 'Not Found' });
    const rest = p.slice(base.length);
    const grant = auth && issued.get(auth.replace('Bearer ', ''));
    const needWrite = method !== 'GET';
    if (needWrite) {
      if (!grant) return json(401, { message: 'Requires authentication' });
      if (!grant.repositories.includes(repo)) return json(403, { message: 'Resource not accessible by integration' });
      const scope = rest.startsWith('/pulls') ? 'pull_requests' : rest.startsWith('/actions') ? 'actions' : 'contents';
      if (grant.permissions[scope] !== 'write') return json(403, { message: 'Resource not accessible by integration' });
    }

    if (method === 'GET' && rest === '') return json(200, { full_name: `${owner}/${repo}`, default_branch: 'develop', private: false, archived: false, open_issues_count: 0, pushed_at: '2026-10-02T00:00:00Z', html_url: `https://github.com/${owner}/${repo}` });
    if (method === 'GET' && rest.startsWith('/branches')) return json(200, [...branches].map(([name, sha]) => ({ name, commit: { sha }, protected: name === 'develop' || name === 'main' })));
    if (method === 'GET' && rest.startsWith('/git/ref/heads/')) {
      const b = rest.slice('/git/ref/heads/'.length);
      return branches.has(b) ? json(200, { ref: `refs/heads/${b}`, object: { sha: branches.get(b), type: 'commit' } }) : json(404, { message: 'Not Found' });
    }
    if (method === 'POST' && rest === '/git/refs') {
      const b = body.ref.replace('refs/heads/', '');
      if (branches.has(b)) return json(422, { message: 'Reference already exists' });
      if (!commits.has(body.sha)) return json(422, { message: 'Object does not exist' });
      branches.set(b, body.sha);
      return json(201, { ref: body.ref, object: { sha: body.sha } });
    }
    if (method === 'GET' && rest.startsWith('/git/commits/')) {
      const c = commits.get(rest.slice('/git/commits/'.length));
      return c ? json(200, { sha: c.sha, tree: { sha: c.treeSha }, parents: c.parents.map(sha => ({ sha })), message: c.message }) : json(404, { message: 'Not Found' });
    }
    if (method === 'POST' && rest === '/git/trees') {
      const baseTree = trees.get(body.base_tree);
      if (!baseTree) return json(422, { message: 'base_tree inválida' });
      const tree = { ...baseTree };
      for (const e of body.tree) tree[e.path] = e.content;
      const sha = sha1(`tree:${JSON.stringify(tree)}:${++n}`);
      trees.set(sha, tree);
      return json(201, { sha });
    }
    if (method === 'POST' && rest === '/git/commits') {
      const tree = trees.get(body.tree);
      if (!tree) return json(422, { message: 'tree inválida' });
      const sha = addCommit(tree, body.parents, body.message);
      commits.get(sha).treeSha = body.tree;
      return json(201, { sha });
    }
    if (method === 'PATCH' && rest.startsWith('/git/refs/heads/')) {
      const b = rest.slice('/git/refs/heads/'.length);
      if (!branches.has(b)) return json(422, { message: 'Reference does not exist' });
      const c = commits.get(body.sha);
      if (!body.force && !(c && c.parents.includes(branches.get(b)))) return json(422, { message: 'Update is not a fast forward' });
      branches.set(b, body.sha);
      return json(200, { ref: `refs/heads/${b}`, object: { sha: body.sha } });
    }
    if (method === 'GET' && rest.startsWith('/contents/')) {
      const path = rest.slice('/contents/'.length);
      const ref = u.searchParams.get('ref') || 'develop';
      const c = commits.get(branches.get(ref) || ref);
      if (!c || !(path in c.tree)) return json(404, { message: 'Not Found' });
      const buf = Buffer.from(c.tree[path]);
      return json(200, { type: 'file', path, sha: sha1(buf), size: buf.length, encoding: 'base64', content: buf.toString('base64') });
    }
    if (method === 'GET' && rest.startsWith('/compare/')) {
      const [from, to] = rest.slice('/compare/'.length).split('...');
      const a = commits.get(branches.get(from)); const b = commits.get(branches.get(to));
      if (!a || !b) return json(404, { message: 'Not Found' });
      const changed = Object.keys(b.tree).filter(k => a.tree[k] !== b.tree[k]);
      const same = a.sha === b.sha;
      return json(200, { status: same ? 'identical' : 'ahead', ahead_by: same ? 0 : 1, behind_by: 0, total_commits: same ? 0 : 1, commits: same ? [] : [{ sha: b.sha, commit: { message: b.message } }],
        files: changed.map(k => ({ filename: k, status: k in a.tree ? 'modified' : 'added', additions: 1, deletions: 0, patch: `+${b.tree[k]}` })) });
    }
    if (method === 'GET' && /^\/commits\/.+\/check-runs$/.test(rest)) {
      const ref = rest.slice('/commits/'.length, -'/check-runs'.length);
      const list = checks.get(ref) || checks.get([...branches].find(([, sha]) => sha === ref)?.[0]) || [];
      return json(200, { total_count: list.length, check_runs: list });
    }
    if (method === 'POST' && rest === '/pulls') {
      if (!branches.has(body.head) || !branches.has(body.base)) return json(422, { message: 'Validation Failed' });
      const pr = { number: pulls.length + 1, ...body, state: 'open', html_url: `https://github.com/${owner}/${repo}/pull/${pulls.length + 1}` };
      pulls.push(pr);
      return json(201, pr);
    }
    if (method === 'POST' && /^\/actions\/workflows\/[^/]+\/dispatches$/.test(rest)) {
      const workflow = rest.split('/')[3];
      dispatches.push({ workflow, ...body });
      runs.push({ id: 9000 + runs.length, workflow, event: 'workflow_dispatch', head_branch: body.ref,
        display_title: workflow === 'nexia-pipeline.yml' ? `nexia-pipeline target=${(body.inputs || {}).target || 'none'}` : workflow, head_sha: branches.get(body.ref) || body.ref,
        status: 'queued', conclusion: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), html_url: `https://github.com/${owner}/${repo}/actions/runs/${9000 + runs.length}` });
      return json(204);
    }
    if (method === 'GET' && /^\/actions\/workflows\/[^/]+\/runs$/.test(rest)) {
      const workflow = rest.split('/')[3];
      const sha = u.searchParams.get('head_sha');
      return json(200, { workflow_runs: runs.filter(r => r.workflow === workflow && (!sha || r.head_sha === sha)) });
    }
    return json(404, { message: 'Not Found' });
  }

  return { fetchImpl, privatePem, appId, installationId, commits, branches, pulls, dispatches, runs, checks, issued, calls,
    env: { GITHUB_APP_ID: appId, GITHUB_APP_PRIVATE_KEY: privatePem.replace(/\n/g, '\\n') },
    fileAt: (branch, path) => commits.get(branches.get(branch)).tree[path] };
}

module.exports = { createFakeGithub };
