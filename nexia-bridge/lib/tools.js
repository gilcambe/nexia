'use strict';
// Ferramentas do NEXIA Bridge (spec §8 e §13): workspace.*, terminal.run e git.*.
// Os nomes MCP usam "_" (workspace_read...) porque clientes como o Claude só aceitam
// [a-zA-Z0-9_-] em nomes de ferramenta.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { BridgeError } = require('./errors');
const { resolveInRoots } = require('./paths');
const { isSensitive, insideGitDir, redact, childEnv } = require('./sensitive');
const { classify } = require('./commands');

// O que cada modo faz com cada classe de operação.
const MODE_MATRIX = {
  // exec_write: comando de terminal que altera arquivos (alcance imprevisível); pede pessoa mesmo no autonomous.
  'read-only':     { read: 'allow', test: 'block', write: 'block', exec_write: 'block', delete: 'block', dangerous: 'block' },
  'write-confirm': { read: 'allow', test: 'allow', write: 'confirm', exec_write: 'confirm', delete: 'confirm', dangerous: 'confirm' },
  autonomous:      { read: 'allow', test: 'allow', write: 'allow', exec_write: 'confirm', delete: 'confirm', dangerous: 'confirm' },
};
const OUTPUT_CAP = 64 * 1024;
const READ_DEFAULT = 200 * 1024;
const READ_MAX = 1024 * 1024;
const WRITE_MAX = 1024 * 1024;
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'out', 'build', '.next', '.cache', 'coverage', '__pycache__', '.venv', 'venv']);
const SENSITIVE_PATHSPEC = [':(exclude,glob)**/.env', ':(exclude,glob)**/.env.*', ':(exclude,glob)**/*.pem', ':(exclude,glob)**/*.key', ':(exclude,glob)**/*service*account*.json', ':(exclude,glob)**/.npmrc', ':(exclude,glob)**/.dev.vars'];

const canonical = v => (Array.isArray(v) ? `[${v.map(canonical).join(',')}]` : v && typeof v === 'object'
  ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}` : JSON.stringify(v));

const S = (props, required = []) => ({ type: 'object', properties: { project_id: { type: 'string', description: 'id do projeto no Vault (veja bridge_projects)' }, ...props }, required: ['project_id', ...required], additionalProperties: false });
const CONFIRM = { confirmation_id: { type: 'string', description: 'id devolvido em confirmation_required, depois que a pessoa aprovar no terminal do Bridge' } };

const DEFINITIONS = [
  { name: 'bridge_projects', description: 'Lista os projetos e workspaces que este Bridge expõe, com o modo de cada um.', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'workspace_list', description: 'workspace.list: lista arquivos e pastas dentro do workspace do projeto.', inputSchema: S({ path: { type: 'string' }, depth: { type: 'integer', minimum: 1, maximum: 3 } }) },
  { name: 'workspace_read', description: 'workspace.read: lê um arquivo de texto do workspace (.env, chaves e credenciais são bloqueados; valores com forma de secret são redigidos).', inputSchema: S({ path: { type: 'string' }, offset: { type: 'integer', minimum: 0 }, max_bytes: { type: 'integer', minimum: 1, maximum: READ_MAX } }, ['path']) },
  { name: 'workspace_write', description: 'workspace.write: grava um arquivo de texto no workspace (exige confirmação no modo write-confirm).', inputSchema: S({ path: { type: 'string' }, content: { type: 'string' }, ...CONFIRM }, ['path', 'content']) },
  { name: 'workspace_delete', description: 'workspace.delete: apaga um arquivo do workspace (sempre exige confirmação humana).', inputSchema: S({ path: { type: 'string' }, ...CONFIRM }, ['path']) },
  { name: 'terminal_run', description: 'terminal.run: executa um comando (sem shell) dentro do workspace. Leitura e testes rodam direto; o resto pede confirmação; deploy, privilégio e shells são bloqueados.', inputSchema: S({ command: { type: 'string' }, args: { type: 'array', items: { type: 'string' } }, cwd: { type: 'string' }, timeout_ms: { type: 'integer', minimum: 1000, maximum: 600000 }, ...CONFIRM }, ['command']) },
  { name: 'git_status', description: 'git.status: estado do repositório do workspace.', inputSchema: S({}) },
  { name: 'git_diff', description: 'git.diff: diferenças locais (sem arquivos sensíveis; valores com forma de secret redigidos).', inputSchema: S({ staged: { type: 'boolean' }, path: { type: 'string' } }) },
  { name: 'git_commit', description: 'git.commit: commita as alterações (só arquivos já versionados, ou os caminhos informados).', inputSchema: S({ message: { type: 'string' }, paths: { type: 'array', items: { type: 'string' } }, ...CONFIRM }, ['message']) },
];

/** Em Windows, os atalhos .cmd (npm, npx...) precisam de shell; aí nenhum argumento pode ter metacaractere do cmd. */
function windowsShim(command, args, platform = process.platform) {
  if (platform !== 'win32' || !['npm', 'npx', 'pnpm', 'yarn'].includes(String(command).toLowerCase())) return null;
  const bad = args.find(a => /[&|<>^%"!\r\n`]/.test(a));
  if (bad !== undefined) throw new BridgeError('INVALID_ARGS', 'Argumento com metacaractere do cmd.exe não é permitido em npm/npx no Windows.');
  return { command: `${command}.cmd`, shell: true };
}

function run(command, args, { cwd, env, timeoutMs }) {
  return new Promise(resolve => {
    const shim = windowsShim(command, args);
    const t0 = Date.now();
    let out = Buffer.alloc(0); let err = Buffer.alloc(0); let truncated = false;
    let child;
    try {
      child = spawn(shim ? shim.command : command, args, { cwd, env, shell: shim ? shim.shell : false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      return resolve({ exit_code: null, error: e.code || 'SPAWN_FAILED', stdout: '', stderr: '', duration_ms: 0, truncated: false });
    }
    const cap = (buf, chunk) => { if (buf.length >= OUTPUT_CAP) { truncated = true; return buf; } const b = Buffer.concat([buf, chunk]); if (b.length > OUTPUT_CAP) { truncated = true; return b.subarray(0, OUTPUT_CAP); } return b; };
    child.stdout.on('data', c => { out = cap(out, c); });
    child.stderr.on('data', c => { err = cap(err, c); });
    const timer = setTimeout(() => { child.kill('SIGKILL'); }, timeoutMs);
    child.on('error', e => { clearTimeout(timer); resolve({ exit_code: null, error: e.code || 'SPAWN_FAILED', stdout: '', stderr: '', duration_ms: Date.now() - t0, truncated }); });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      const o = redact(out.toString('utf8'));
      const e = redact(err.toString('utf8'));
      resolve({ exit_code: code, signal: signal || null, timed_out: signal === 'SIGKILL' && Date.now() - t0 >= timeoutMs, stdout: o.text, stderr: e.text, redactions: o.redactions + e.redactions, truncated, duration_ms: Date.now() - t0 });
    });
  });
}

/**
 * @param {{ config, log, approvals, elicit?: (message) => Promise<boolean>|null, notify?: (text) => void, agent?: () => string, env?: object }} o
 */
function createTools(o) {
  const { config, log, approvals } = o;
  const env = o.env || process.env;
  const notify = o.notify || (t => process.stderr.write(`${t}\n`));
  const agent = o.agent || (() => 'desconhecido');
  const projectOf = id => {
    const p = config.projects.find(x => x.project_id === id);
    if (!p) throw new BridgeError('UNKNOWN_PROJECT', 'Projeto não configurado neste Bridge.');
    return p;
  };
  const resolve = (p, rel) => resolveInRoots(p.roots, rel === undefined ? '.' : rel);

  /** Aplica o modo; devolve null para seguir ou o resultado de "confirmação pendente". */
  async function gate(p, tool, args, cls, summary) {
    const action = MODE_MATRIX[p.mode][cls];
    if (action === 'allow') return { decision: 'allow' };
    if (action === 'block') throw new BridgeError('BLOCKED_BY_MODE', `O projeto está em modo ${p.mode}: ${summary} não é permitido.`, { cls });
    const fingerprint = crypto.createHash('sha256').update(canonical({ tool, project: p.project_id, args: { ...args, confirmation_id: undefined } })).digest('hex');
    if (o.elicit && o.elicit.supported && o.elicit.supported()) {
      const ok = await o.elicit(`NEXIA Bridge (${p.name}): permitir ${summary}?`);
      if (!ok) throw new BridgeError('NOT_APPROVED', 'A pessoa não aprovou a operação.');
      return { decision: 'confirmed', via: 'elicitation' };
    }
    if (args.confirmation_id) {
      const r = approvals.consume(args.confirmation_id, fingerprint);
      if (r.ok) return { decision: 'confirmed', via: 'terminal' };
      if (r.pending) return { pending: { status: 'confirmation_pending', confirmation_id: args.confirmation_id, message: r.reason } };
      throw new BridgeError('NOT_APPROVED', r.reason);
    }
    const { id, code } = approvals.request(fingerprint, summary);
    notify(`[NEXIA Bridge] Pedido de confirmação ${id} (${p.name}): ${summary}\n[NEXIA Bridge] Para aprovar: nexia-bridge approve ${id} ${code}`);
    return { pending: { status: 'confirmation_required', confirmation_id: id, message: `Operação aguardando aprovação humana no terminal do NEXIA Bridge (pedido ${id}). Depois da aprovação, repita a chamada com confirmation_id="${id}".` } };
  }

  const handlers = {
    async bridge_projects() {
      return { projects: config.projects.map(p => ({ project_id: p.project_id, name: p.name, mode: p.mode, roots: p.roots })) };
    },

    async workspace_list(p, a) {
      const { abs, root } = resolve(p, a.path);
      const depth = Math.min(Math.max(a.depth || 1, 1), 3);
      const entries = [];
      const walk = (dir, d) => {
        for (const ent of fs.readdirSync(dir, { withFileTypes: true }).sort((x, y) => x.name.localeCompare(y.name))) {
          if (entries.length >= 2000) return;
          const full = path.join(dir, ent.name);
          const rel = path.relative(root, full).split(path.sep).join('/');
          if (ent.isDirectory() && SKIP_DIRS.has(ent.name)) { entries.push({ path: rel, type: 'dir', skipped: true }); continue; }
          const type = ent.isSymbolicLink() ? 'symlink' : ent.isDirectory() ? 'dir' : 'file';
          const e = { path: rel, type };
          if (type === 'file') { try { e.size = fs.statSync(full).size; } catch { /* sumiu */ } }
          if (isSensitive(rel)) e.sensitive = true;
          entries.push(e);
          if (type === 'dir' && d < depth) walk(full, d + 1);
        }
      };
      if (!fs.statSync(abs).isDirectory()) throw new BridgeError('NOT_A_DIRECTORY', 'O caminho não é uma pasta.');
      walk(abs, 1);
      return { entries, truncated: entries.length >= 2000 };
    },

    async workspace_read(p, a) {
      const { abs, rel } = resolve(p, a.path);
      if (isSensitive(rel) || isSensitive(abs)) throw new BridgeError('SENSITIVE_FILE', 'Arquivo sensível (.env, chave, credencial ou .git): o Bridge não lê.');
      const st = fs.statSync(abs);
      if (!st.isFile()) throw new BridgeError('NOT_A_FILE', 'O caminho não é um arquivo.');
      const max = Math.min(a.max_bytes || READ_DEFAULT, READ_MAX);
      const offset = a.offset || 0;
      const fd = fs.openSync(abs, 'r');
      const buf = Buffer.alloc(Math.max(0, Math.min(max, st.size - offset)));
      try { fs.readSync(fd, buf, 0, buf.length, offset); } finally { fs.closeSync(fd); }
      if (buf.includes(0)) return { path: rel, size: st.size, binary: true };
      const r = redact(buf.toString('utf8'));
      return { path: rel, size: st.size, offset, content: r.text, truncated: offset + buf.length < st.size, redactions: r.redactions };
    },

    async workspace_write(p, a) {
      const { abs, rel } = resolve(p, a.path);
      if (isSensitive(rel) || insideGitDir(rel)) throw new BridgeError('SENSITIVE_FILE', 'O Bridge não escreve em arquivos sensíveis nem dentro de .git.');
      if (typeof a.content !== 'string' || Buffer.byteLength(a.content) > WRITE_MAX) throw new BridgeError('INVALID_ARGS', 'content deve ser texto de até 1 MB.');
      if (redact(a.content).redactions) throw new BridgeError('SECRET_IN_CONTENT', 'O conteúdo parece conter um secret; use variável de ambiente ou secret store.');
      if (fs.existsSync(abs) && !fs.statSync(abs).isFile()) throw new BridgeError('NOT_A_FILE', 'O caminho existe e não é um arquivo.');
      const g = await gate(p, 'workspace_write', a, 'write', `gravar ${rel} (${Buffer.byteLength(a.content)} bytes)`);
      if (g.pending) return g.pending;
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      resolve(p, path.dirname(abs)); // a pasta criada continua dentro da raiz
      const tmp = path.join(path.dirname(abs), `.nexia-tmp-${crypto.randomBytes(4).toString('hex')}`);
      fs.writeFileSync(tmp, a.content);
      fs.renameSync(tmp, abs);
      return { status: 'written', path: rel, bytes: Buffer.byteLength(a.content), confirmed: g.decision === 'confirmed' };
    },

    async workspace_delete(p, a) {
      const { abs, rel } = resolve(p, a.path);
      if (isSensitive(rel) || insideGitDir(rel)) throw new BridgeError('SENSITIVE_FILE', 'O Bridge não apaga arquivos sensíveis nem dentro de .git.');
      if (rel === '.' || !fs.existsSync(abs) || !fs.lstatSync(abs).isFile()) throw new BridgeError('NOT_A_FILE', 'Só arquivos podem ser apagados (sem pastas).');
      const g = await gate(p, 'workspace_delete', a, 'delete', `apagar ${rel}`);
      if (g.pending) return g.pending;
      fs.unlinkSync(abs);
      return { status: 'deleted', path: rel };
    },

    async terminal_run(p, a) {
      const args = Array.isArray(a.args) ? a.args.map(String) : [];
      if (typeof a.command !== 'string' || !a.command.trim() || /[\s;&|<>`$]/.test(a.command)) throw new BridgeError('INVALID_ARGS', 'command deve ser só o executável (os argumentos vão em args).');
      const { abs: cwd, rel } = resolve(p, a.cwd);
      if (!fs.statSync(cwd).isDirectory()) throw new BridgeError('NOT_A_DIRECTORY', 'cwd não é uma pasta.');
      // Executável por caminho precisa estar dentro do workspace
      if (/[\\/]/.test(a.command)) resolve(p, path.isAbsolute(a.command) ? a.command : path.join(rel, a.command));
      const c = classify(a.command, args, p.commands);
      if (c.cls === 'denied') throw new BridgeError('COMMAND_DENIED', c.reason);
      const shown = redact([a.command, ...args].join(' ')).text.slice(0, 300);
      const g = await gate(p, 'terminal_run', a, c.cls === 'write' ? 'exec_write' : c.cls, `executar "${shown}" em ${rel} (${c.reason})`);
      if (g.pending) return g.pending;
      const r = await run(a.command, args, { cwd, env: childEnv(env, p.passEnv), timeoutMs: a.timeout_ms || 120000 });
      return { ...r, class: c.cls, cwd: rel };
    },

    async git_status(p) {
      const { abs } = resolve(p, '.');
      const r = await run('git', ['status', '--porcelain=v1', '-b'], { cwd: abs, env: childEnv(env), timeoutMs: 30000 });
      if (r.exit_code !== 0) throw new BridgeError('GIT_FAILED', 'git status falhou (o workspace é um repositório git?).', { stderr: r.stderr.slice(0, 500) });
      const lines = r.stdout.split('\n').filter(Boolean);
      return { branch: (lines[0] || '').replace(/^## /, ''), changes: lines.slice(1).map(l => ({ status: l.slice(0, 2), path: l.slice(3) })) };
    },

    async git_diff(p, a) {
      const { abs } = resolve(p, '.');
      const spec = a.path ? [resolve(p, a.path).rel] : ['.'];
      const r = await run('git', ['diff', ...(a.staged ? ['--staged'] : []), '--', ...spec, ...SENSITIVE_PATHSPEC], { cwd: abs, env: childEnv(env), timeoutMs: 60000 });
      if (r.exit_code !== 0) throw new BridgeError('GIT_FAILED', 'git diff falhou.', { stderr: r.stderr.slice(0, 500) });
      return { diff: r.stdout, truncated: r.truncated, redactions: r.redactions };
    },

    async git_commit(p, a) {
      const { abs } = resolve(p, '.');
      if (typeof a.message !== 'string' || !a.message.trim() || a.message.length > 2000) throw new BridgeError('INVALID_ARGS', 'message obrigatória (até 2000 caracteres).');
      if (redact(a.message).redactions) throw new BridgeError('SECRET_IN_CONTENT', 'A mensagem parece conter um secret.');
      const paths = Array.isArray(a.paths) ? a.paths.map(x => resolve(p, x).rel) : null;
      if (paths && paths.some(x => isSensitive(x))) throw new BridgeError('SENSITIVE_FILE', 'Arquivo sensível não pode ser commitado pelo Bridge.');
      const g = await gate(p, 'git_commit', a, 'write', `commitar ${paths ? paths.join(', ') : 'alterações em arquivos versionados'}: "${a.message.slice(0, 80)}"`);
      if (g.pending) return g.pending;
      const e = childEnv(env);
      const add = await run('git', paths ? ['add', '--', ...paths] : ['add', '-u'], { cwd: abs, env: e, timeoutMs: 60000 });
      if (add.exit_code !== 0) throw new BridgeError('GIT_FAILED', 'git add falhou.', { stderr: add.stderr.slice(0, 500) });
      const staged = await run('git', ['diff', '--staged', '--name-only'], { cwd: abs, env: e, timeoutMs: 30000 });
      const bad = staged.stdout.split('\n').filter(Boolean).filter(isSensitive);
      if (bad.length) {
        // Tira tudo do stage (os arquivos continuam como estão no disco) para não sobrar commit pela metade.
        await run('git', ['reset', '-q', '--', ...staged.stdout.split('\n').filter(Boolean)], { cwd: abs, env: e, timeoutMs: 30000 });
        throw new BridgeError('SENSITIVE_FILE', 'Havia arquivo sensível no stage; o stage foi limpo e nada foi commitado.', { files: bad.length });
      }
      if (!staged.stdout.trim()) throw new BridgeError('NOTHING_TO_COMMIT', 'Nada para commitar.');
      const c = await run('git', ['commit', '-m', a.message], { cwd: abs, env: e, timeoutMs: 60000 });
      if (c.exit_code !== 0) throw new BridgeError('GIT_FAILED', 'git commit falhou.', { stderr: c.stderr.slice(0, 500) });
      const sha = await run('git', ['rev-parse', 'HEAD'], { cwd: abs, env: e, timeoutMs: 10000 });
      return { status: 'committed', commit: sha.stdout.trim(), files: staged.stdout.split('\n').filter(Boolean) };
    },
  };

  /** Executa uma ferramenta e registra no log. Nunca lança: devolve { ok, result | error }. */
  async function call(name, args = {}) {
    const t0 = Date.now();
    const entry = { agent: agent(), tool: name, project_id: args.project_id || null };
    if (name === 'terminal_run') Object.assign(entry, { command: redact([args.command, ...(args.args || [])].join(' ')).text.slice(0, 300), cwd: args.cwd || '.' });
    else if (args.path !== undefined) entry.path = String(args.path).slice(0, 300);
    try {
      if (!handlers[name]) throw new BridgeError('UNKNOWN_TOOL', `Ferramenta desconhecida: ${name}`);
      const p = name === 'bridge_projects' ? null : projectOf(args.project_id);
      const result = await handlers[name](p, args);
      log.write({ ...entry, status: result.status === 'confirmation_required' || result.status === 'confirmation_pending' ? result.status : 'ok',
        ...(result.exit_code !== undefined ? { exit_code: result.exit_code, class: result.class } : {}), ...(result.confirmation_id ? { confirmation_id: result.confirmation_id } : {}),
        duration_ms: Date.now() - t0 });
      return { ok: true, result };
    } catch (e) {
      const code = e instanceof BridgeError ? e.code : 'INTERNAL';
      log.write({ ...entry, status: 'error', error_code: code, duration_ms: Date.now() - t0 });
      return { ok: false, error: { code, message: e instanceof BridgeError ? e.message : 'Erro interno do Bridge.' } };
    }
  }

  return { definitions: DEFINITIONS, call };
}

module.exports = { createTools, DEFINITIONS, MODE_MATRIX, windowsShim };
