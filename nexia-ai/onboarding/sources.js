'use strict';
// Fontes de leitura de um repositório para o onboarding. Só leitura.
//  - createGithubSource: API REST do GitHub (repo público sem token; privado com o
//    GITHUB_TOKEN já configurado no servidor, nenhuma credencial nova).
//  - createLocalSource: pasta local (checkout), presa à raiz, sem seguir symlink
//    para fora e sem ler arquivos .env.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const MAX_FILE_BYTES = 256 * 1024;
const MAX_FILES = 20000;
const IGNORED_DIRS = new Set(['.git', 'node_modules', 'out', 'dist', 'build', '.next', 'coverage', 'playwright-report', 'test-results', '.firebase']);
// Nunca lemos conteúdo de arquivos que costumam guardar segredos.
const NEVER_READ = /(^|\/)(\.env(\.(?!example$|sample$|template$)[^/]*)?|.*\.pem|.*\.key|id_rsa[^/]*|service-?account[^/]*\.json|credentials[^/]*\.json)$/i;

class SourceError extends Error {
  constructor(code, message) { super(message); this.name = 'SourceError'; this.code = code; }
}

const OWNER_RE = /^[A-Za-z0-9_.-]{1,100}$/;
const REF_RE = /^[A-Za-z0-9._/-]{1,255}$/;

/**
 * @param {{ owner: string, repo: string, ref?: string, token?: string, fetchImpl?: typeof fetch, apiBase?: string }} o
 */
function createGithubSource({ owner, repo, ref, token = process.env.GITHUB_TOKEN, fetchImpl = globalThis.fetch, apiBase = 'https://api.github.com' }) {
  if (!OWNER_RE.test(owner || '') || !OWNER_RE.test(repo || '')) throw new SourceError('INVALID', 'owner/repo inválidos.');
  if (ref !== undefined && !REF_RE.test(ref)) throw new SourceError('INVALID', 'ref inválida.');
  const headers = { 'User-Agent': 'nexia-ai-onboarding', 'X-GitHub-Api-Version': '2022-11-28' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const base = `${apiBase}/repos/${owner}/${repo}`;

  async function call(pathname, accept = 'application/vnd.github+json') {
    const r = await fetchImpl(base + pathname, { headers: { ...headers, Accept: accept } });
    if (r.status === 404) return null;
    if (!r.ok) {
      const code = r.status === 401 || r.status === 403 ? 'FORBIDDEN' : 'UPSTREAM';
      throw new SourceError(code, `GitHub respondeu ${r.status}.`);
    }
    return accept.includes('raw') ? r.text() : r.json();
  }

  let metaCache = null;
  let treeCache = null;
  return {
    kind: 'github',
    async meta() {
      if (metaCache) return metaCache;
      const m = await call('');
      if (!m) throw new SourceError('NOT_FOUND', 'Repositório não encontrado ou sem acesso.');
      const branches = await call('/branches?per_page=100');
      metaCache = {
        provider: 'github', owner: m.owner.login, repo: m.name, url: m.html_url,
        default_branch: m.default_branch, visibility: m.private ? 'private' : 'public',
        branches: Array.isArray(branches) ? branches.map(b => b.name).filter(n => REF_RE.test(n)).slice(0, 200) : [],
      };
      return metaCache;
    },
    async files() {
      if (treeCache) return treeCache;
      const r = ref || (await this.meta()).default_branch;
      const t = await call(`/git/trees/${encodeURIComponent(r)}?recursive=1`);
      if (!t) throw new SourceError('NOT_FOUND', 'Branch não encontrada.');
      treeCache = t.tree.filter(e => e.type === 'blob').map(e => e.path)
        .filter(p => !p.split('/').some(seg => IGNORED_DIRS.has(seg))).slice(0, MAX_FILES);
      treeCache.truncated = !!t.truncated;
      return treeCache;
    },
    async read(p) {
      if (NEVER_READ.test(p)) return null;
      const r = ref || (await this.meta()).default_branch;
      const text = await call(`/contents/${p.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(r)}`, 'application/vnd.github.raw+json');
      return typeof text === 'string' && text.length <= MAX_FILE_BYTES ? text : null;
    },
  };
}

/** @param {string} root  pasta do checkout */
function createLocalSource(root) {
  const realRoot = fs.realpathSync(root);
  const inside = p => p === realRoot || p.startsWith(realRoot + path.sep);
  return {
    kind: 'local',
    async meta() { return null; },
    async files() {
      // Checkout git: só arquivos versionados (ignora build, logs e arquivos locais).
      if (fs.existsSync(path.join(realRoot, '.git'))) {
        try {
          const listed = execFileSync('git', ['-C', realRoot, 'ls-files', '-z'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
          return listed.split('\0').filter(Boolean)
            .filter(p => !p.split('/').some(seg => IGNORED_DIRS.has(seg))).slice(0, MAX_FILES).sort();
        } catch { /* sem git disponível: varre a pasta */ }
      }
      const out = [];
      const walk = rel => {
        if (out.length >= MAX_FILES) return;
        for (const ent of fs.readdirSync(path.join(realRoot, rel), { withFileTypes: true })) {
          const relPath = rel ? `${rel}/${ent.name}` : ent.name;
          if (ent.isSymbolicLink()) continue;
          if (ent.isDirectory()) { if (!IGNORED_DIRS.has(ent.name)) walk(relPath); }
          else if (ent.isFile()) out.push(relPath);
        }
      };
      walk('');
      return out.sort();
    },
    async read(rel) {
      if (NEVER_READ.test(rel) || rel.split('/').includes('..')) return null;
      const full = path.join(realRoot, rel);
      let real;
      try { real = fs.realpathSync(full); } catch { return null; }
      if (!inside(real)) return null;
      const st = fs.statSync(real);
      if (!st.isFile() || st.size > MAX_FILE_BYTES) return null;
      return fs.readFileSync(real, 'utf8');
    },
  };
}

module.exports = { createGithubSource, createLocalSource, SourceError, NEVER_READ, IGNORED_DIRS };
