'use strict';
// Fase 7: NEXIA Bridge (servidor MCP local). Testes obrigatórios da spec §28 sobre a
// máquina local: proteção de workspace, bloqueio de path traversal, bloqueio de
// comandos perigosos, permissões (modos) e registro de cada operação.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn, execFileSync } = require('child_process');
const { resolveInRoots, isInside } = require('../../nexia-bridge/lib/paths');
const { classify } = require('../../nexia-bridge/lib/commands');
const { isSensitive, redact, childEnv } = require('../../nexia-bridge/lib/sensitive');
const { validateConfig } = require('../../nexia-bridge/lib/config');
const { createLog } = require('../../nexia-bridge/lib/log');
const { createApprovals, approveFromCli } = require('../../nexia-bridge/lib/approvals');
const { createTools, windowsShim } = require('../../nexia-bridge/lib/tools');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'nexia-bridge-'));
const ROOT = path.join(TMP, 'projetos', 'nexia');
const OUTSIDE = path.join(TMP, 'fora');
const STATE = path.join(TMP, 'state');
const fakeKey = () => `gsk_${crypto.randomBytes(24).toString('hex')}`;
const git = (...a) => execFileSync('git', a, { cwd: ROOT, stdio: 'pipe' }).toString();

test.before(() => {
  fs.mkdirSync(path.join(ROOT, 'src'), { recursive: true });
  fs.mkdirSync(OUTSIDE, { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'src', 'app.js'), 'console.log("oi");\n');
  fs.writeFileSync(path.join(ROOT, '.env'), `GROQ_API_KEY=${fakeKey()}\n`);
  fs.writeFileSync(path.join(ROOT, '.env.example'), 'GROQ_API_KEY=\n');
  fs.writeFileSync(path.join(ROOT, 'config.js'), `module.exports = { apiKey: "${fakeKey()}" };\n`);
  fs.writeFileSync(path.join(OUTSIDE, 'segredo.txt'), 'fora do workspace');
  fs.symlinkSync(OUTSIDE, path.join(ROOT, 'atalho-fora'));
  fs.symlinkSync(path.join(ROOT, 'src'), path.join(ROOT, 'atalho-dentro'));
  git('init', '-q', '-b', 'develop');
  git('config', 'user.email', 'bridge@test'); git('config', 'user.name', 'Bridge Test');
  fs.writeFileSync(path.join(ROOT, '.gitignore'), '.env\n');
  fs.writeFileSync(path.join(ROOT, '.env.local'), 'X=1\n');
  git('add', 'src/app.js', '.gitignore', '.env.example', '.env.local', 'config.js');
  git('commit', '-q', '-m', 'inicial');
});
test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));

function bridge(mode, extra = {}) {
  const config = validateConfig({ stateDir: STATE, projects: [{ project_id: 'prj_nexia', name: 'NEXIA OS', roots: [ROOT], mode, ...extra }] });
  const log = createLog(config.stateDir);
  const approvals = createApprovals(config.stateDir);
  const notes = [];
  const tools = createTools({ config, log, approvals, notify: t => notes.push(t), agent: () => 'teste', env: { PATH: process.env.PATH, HOME: process.env.HOME, GROQ_API_KEY: 'nao-deve-vazar', NODE_ENV: 'test' } });
  return { ...tools, log, notes, run: (name, args) => tools.call(name, { project_id: 'prj_nexia', ...args }) };
}

test('W1. path traversal: .., absoluto fora, UNC, drive relativo e byte nulo são bloqueados', () => {
  const bad = { '../fora/segredo.txt': 'OUTSIDE_WORKSPACE', 'src/../../fora': 'OUTSIDE_WORKSPACE', [path.join(OUTSIDE, 'segredo.txt')]: 'OUTSIDE_WORKSPACE', '/etc/passwd': 'OUTSIDE_WORKSPACE',
    '\\\\servidor\\share\\x': 'OUTSIDE_WORKSPACE', '//servidor/share': 'OUTSIDE_WORKSPACE', 'C:arquivo': 'INVALID_PATH', 'src/a\0b': 'INVALID_PATH' };
  for (const [p, code] of Object.entries(bad)) assert.throws(() => resolveInRoots([ROOT], p), e => e.code === code, p);
  assert.strictEqual(resolveInRoots([ROOT], 'src/app.js').rel, 'src/app.js', 'sempre com /, também no Windows');
  assert.strictEqual(resolveInRoots([ROOT], path.join(ROOT, 'src')).rel, 'src');
  assert.strictEqual(resolveInRoots([ROOT], 'src/novo/arquivo.ts').rel, 'src/novo/arquivo.ts');
  // Windows: sem caixa e sem confundir prefixo de nome
  assert.ok(isInside('D:\\Projetos\\nexia', 'd:\\projetos\\NEXIA\\src', path.win32));
  assert.ok(!isInside('D:\\Projetos\\nexia', 'D:\\Projetos\\nexia2\\src', path.win32));
  assert.ok(!isInside('D:\\Projetos\\nexia', 'E:\\Projetos\\nexia', path.win32));
});

test('W2. symlink: link para fora do workspace é bloqueado; link interno funciona', async () => {
  assert.throws(() => resolveInRoots([ROOT], 'atalho-fora/segredo.txt'), e => e.code === 'SYMLINK_ESCAPE');
  assert.throws(() => resolveInRoots([ROOT], 'atalho-fora/novo.txt'), e => e.code === 'SYMLINK_ESCAPE');
  const b = bridge('autonomous');
  const w = await b.run('workspace_write', { path: 'atalho-fora/x.txt', content: 'x' });
  assert.deepStrictEqual([w.ok, w.error.code], [false, 'SYMLINK_ESCAPE']);
  assert.ok(!fs.existsSync(path.join(OUTSIDE, 'x.txt')));
  const r = await b.run('workspace_read', { path: 'atalho-dentro/app.js' });
  assert.match(r.result.content, /console\.log/);
});

test('W3. .env e credenciais nunca são lidos nem escritos; secrets em arquivos comuns são redigidos', async () => {
  const b = bridge('autonomous');
  for (const p of ['.env', '.git/config', 'atalho-dentro/../.env']) {
    const r = await b.run('workspace_read', { path: p });
    assert.deepStrictEqual([r.ok, r.error.code], [false, 'SENSITIVE_FILE'], p);
  }
  assert.strictEqual((await b.run('workspace_read', { path: '.env.example' })).result.content, 'GROQ_API_KEY=\n');
  const cfg = await b.run('workspace_read', { path: 'config.js' });
  assert.ok(!/gsk_[0-9a-f]{20}/.test(cfg.result.content), 'chave redigida');
  assert.ok(cfg.result.redactions >= 1);
  const list = await b.run('workspace_list', { path: '.' });
  assert.deepStrictEqual(list.result.entries.find(e => e.path === '.env'), { path: '.env', type: 'file', size: fs.statSync(path.join(ROOT, '.env')).size, sensitive: true });
  assert.ok(list.result.entries.find(e => e.path === '.git').skipped);
  for (const p of ['.env', '.env.production', 'chave.pem', '.git/hooks/pre-commit']) {
    assert.strictEqual((await b.run('workspace_write', { path: p, content: 'x' })).error.code, 'SENSITIVE_FILE', p);
  }
  assert.strictEqual((await b.run('workspace_write', { path: 'src/k.js', content: `const k = "${fakeKey()}";` })).error.code, 'SECRET_IN_CONTENT');
  assert.ok(isSensitive('firebase-service-account.json') && isSensitive('id_ed25519') && isSensitive('.dev.vars') && !isSensitive('.env.example'));
});

test('W4. comandos perigosos: deploy/privilégio negados; shell e código arbitrário pedem aprovação; leitura e testes passam', () => {
  const t = (cmd, ...args) => classify(cmd, args).cls;
  const table = {
    denied: [t('sudo', 'ls'), t('firebase', 'deploy'), t('npm', 'publish'), t('wrangler', 'deploy'), t('vercel', '--prod'), t('gh', 'secret', 'set', 'X'),
      t('cat', '.env'), t('type', 'C:\\app\\.env.local'), t('git', 'config', 'credential.helper', 'store'), t('nexia-bridge', 'approve'), t('ssh', 'host'), t('format', 'C:'), t('gcloud', 'run', 'deploy')],
    dangerous: [t('bash', '-c', 'ls'), t('powershell', 'Get-ChildItem'), t('cmd.exe', '/c', 'dir'), t('node', '-e', 'x'), t('python', '-c', 'x'), t('git', 'push', '--force'),
      t('git', 'reset', '--hard'), t('git', 'clean', '-fd'), t('rm', '-rf', 'src'), t('rmdir', 'src'), t('npx', 'pacote-qualquer'), t('chmod', '777', 'x'), t('git', 'checkout', '.')],
    read: [t('git', 'status'), t('git', 'log', '--oneline'), t('git', 'diff'), t('ls', '-la'), t('node', '--version'), t('git', 'branch')],
    test: [t('npm', 'test'), t('npm', 'run', 'lint'), t('npm', 'run', 'typecheck'), t('npm', 'run', 'build'), t('npx', 'tsc', '--noEmit'), t('pytest')],
    write: [t('git', 'commit', '-m', 'x'), t('git', 'push'), t('npm', 'install'), t('touch', 'x'), t('rm', 'arquivo.txt'), t('git', 'branch', '-D', 'x'), t('npm', 'run', 'deploy:staging')],
  };
  for (const [cls, got] of Object.entries(table)) assert.deepStrictEqual(got, got.map(() => cls), cls);
  assert.strictEqual(classify('make', [], { deny: ['make'] }).cls, 'denied');
});

test('W5. modo read-only: só leitura; escrita, testes, delete e commit são bloqueados', async () => {
  const b = bridge('read-only');
  assert.strictEqual((await b.run('terminal_run', { command: 'git', args: ['status', '--short'] })).ok, true);
  for (const [tool, args] of [['workspace_write', { path: 'src/n.js', content: 'x' }], ['workspace_delete', { path: 'src/app.js' }], ['terminal_run', { command: 'npm', args: ['test'] }],
    ['terminal_run', { command: 'touch', args: ['x'] }], ['git_commit', { message: 'x' }]]) {
    const r = await b.run(tool, args);
    assert.deepStrictEqual([r.ok, r.error.code], [false, 'BLOCKED_BY_MODE'], tool);
  }
  const denied = await b.run('terminal_run', { command: 'firebase', args: ['deploy'] });
  assert.strictEqual(denied.error.code, 'COMMAND_DENIED');
  assert.ok(!fs.existsSync(path.join(ROOT, 'src', 'n.js')));
});

test('W6. modo write-confirm: o código de aprovação só aparece no terminal do Bridge; o modelo não aprova sozinho', async () => {
  const b = bridge('write-confirm');
  const a = { path: 'src/novo.js', content: 'export const ok = true;\n' };
  const r1 = await b.run('workspace_write', a);
  assert.strictEqual(r1.result.status, 'confirmation_required');
  const id = r1.result.confirmation_id;
  assert.ok(!fs.existsSync(path.join(ROOT, 'src', 'novo.js')));
  const code = /approve ([0-9a-f]{12}) ([A-Z2-9]{8})/.exec(b.notes.at(-1));
  assert.ok(code && code[1] === id, 'código no stderr do Bridge');
  assert.ok(!JSON.stringify(r1).includes(code[2]), 'o resultado da ferramenta não traz o código');
  // repetir antes de aprovar: continua pendente
  assert.strictEqual((await b.run('workspace_write', { ...a, confirmation_id: id })).result.status, 'confirmation_pending');
  // repetir com outro conteúdo: recusado
  approveFromCli(STATE, id, code[2]);
  assert.strictEqual((await b.run('workspace_write', { ...a, content: 'outro', confirmation_id: id })).error.code, 'NOT_APPROVED');
  // pedido novo, código errado cancela
  const r2 = await b.run('workspace_write', a);
  approveFromCli(STATE, r2.result.confirmation_id, 'AAAAAAAA');
  assert.match((await b.run('workspace_write', { ...a, confirmation_id: r2.result.confirmation_id })).error.message, /incorreto/);
  // pedido novo, aprovado certo
  const r3 = await b.run('workspace_write', a);
  const c3 = /approve ([0-9a-f]{12}) ([A-Z2-9]{8})/.exec(b.notes.at(-1));
  approveFromCli(STATE, c3[1], c3[2]);
  const done = await b.run('workspace_write', { ...a, confirmation_id: r3.result.confirmation_id });
  assert.deepStrictEqual([done.result.status, done.result.confirmed], ['written', true]);
  assert.strictEqual(fs.readFileSync(path.join(ROOT, 'src', 'novo.js'), 'utf8'), a.content);
  // uso único
  assert.strictEqual((await b.run('workspace_write', { ...a, confirmation_id: r3.result.confirmation_id })).error.code, 'NOT_APPROVED');
  // testes rodam direto; shell pede confirmação
  assert.strictEqual((await b.run('terminal_run', { command: 'bash', args: ['-c', 'echo x'] })).result.status, 'confirmation_required');
});

test('W7. modo autonomous: escrita direta; apagar e comandos de escrita ainda pedem pessoa', async () => {
  const b = bridge('autonomous');
  assert.strictEqual((await b.run('workspace_write', { path: 'src/auto.js', content: 'x\n' })).result.status, 'written');
  const del = await b.run('workspace_delete', { path: 'src/auto.js' }); assert.strictEqual(del.result && del.result.status, 'confirmation_required', JSON.stringify(del.error));
  const tr = await b.run('terminal_run', { command: 'touch', args: ['y'] }); assert.strictEqual(tr.result && tr.result.status, 'confirmation_required', JSON.stringify(tr));
  assert.ok(fs.existsSync(path.join(ROOT, 'src', 'auto.js')));
});

test('W8. terminal.run: sem shell (metacaracteres são texto), sem secrets no ambiente, cwd preso ao workspace', async () => {
  const b = bridge('read-only');
  const echo = await b.run('terminal_run', { command: 'echo', args: ['$(whoami); rm -rf / && echo', '`id`'] });
  assert.deepStrictEqual([echo.result.exit_code, echo.result.stdout], [0, '$(whoami); rm -rf / && echo `id`\n']);
  assert.strictEqual((await b.run('terminal_run', { command: 'echo hi; ls' })).error.code, 'INVALID_ARGS');
  assert.strictEqual((await b.run('terminal_run', { command: 'ls', cwd: '../fora' })).error.code, 'OUTSIDE_WORKSPACE');
  assert.strictEqual((await b.run('terminal_run', { command: path.join(OUTSIDE, 'x.sh') })).error.code, 'OUTSIDE_WORKSPACE');
  assert.deepStrictEqual(Object.keys(childEnv({ PATH: '/bin', GROQ_API_KEY: 'x', FIREBASE_SERVICE_ACCOUNT: 'y', GITHUB_TOKEN: 'z', NODE_ENV: 't', DB_PASSWORD: 'p' })), ['PATH', 'FIREBASE_SERVICE_ACCOUNT', 'NODE_ENV']);
  assert.deepStrictEqual(Object.keys(childEnv({ GITHUB_TOKEN: 'z' }, ['GITHUB_TOKEN'])), ['GITHUB_TOKEN']);
  assert.throws(() => windowsShim('npm', ['run', 'test & del /q *'], 'win32'), e => e.code === 'INVALID_ARGS');
  assert.deepStrictEqual(windowsShim('npm', ['test'], 'win32'), { command: 'npm.cmd', shell: true });
  assert.strictEqual(windowsShim('npm', ['test'], 'linux'), null);
});

test('W9. git: status e diff sem arquivos sensíveis; commit não leva .env', async () => {
  const b = bridge('autonomous');
  fs.writeFileSync(path.join(ROOT, 'src', 'app.js'), 'console.log("mudou");\n');
  fs.writeFileSync(path.join(ROOT, '.env.local'), 'X=2\n');
  const st = await b.run('git_status', {});
  assert.strictEqual(st.result.branch.split('...')[0], 'develop');
  assert.ok(st.result.changes.some(c => c.path === 'src/app.js'));
  const diff = await b.run('git_diff', {});
  assert.match(diff.result.diff, /mudou/);
  assert.ok(!diff.result.diff.includes('.env.local'), 'diff exclui arquivos sensíveis');
  const c1 = await b.run('git_commit', { message: 'Atualiza app' });
  assert.deepStrictEqual([c1.ok, c1.error.code], [false, 'SENSITIVE_FILE']);
  assert.strictEqual(git('diff', '--staged', '--name-only').trim(), '', 'nada ficou no stage');
  const c2 = await b.run('git_commit', { message: 'Atualiza app', paths: ['src/app.js'] });
  assert.strictEqual(c2.result.status, 'committed');
  assert.match(c2.result.commit, /^[0-9a-f]{40}$/);
  assert.deepStrictEqual(c2.result.files, ['src/app.js']);
  assert.strictEqual((await b.run('git_commit', { message: 'x', paths: ['.env.local'] })).error.code, 'SENSITIVE_FILE');
  git('checkout', '-q', '--', '.env.local');
});

test('W10. registro: comando, diretório, resultado e agente de cada operação, sem conteúdo', async () => {
  const b = bridge('read-only');
  const before = b.log.read().length;
  await b.run('terminal_run', { command: 'git', args: ['log', '--oneline', '-1'], cwd: 'src' });
  await b.run('workspace_read', { path: '.env' });
  await b.run('workspace_read', { path: 'src/app.js' });
  const entries = b.log.read().slice(before);
  assert.deepStrictEqual(entries.map(e => [e.agent, e.tool, e.project_id, e.status]), [
    ['teste', 'terminal_run', 'prj_nexia', 'ok'], ['teste', 'workspace_read', 'prj_nexia', 'error'], ['teste', 'workspace_read', 'prj_nexia', 'ok']]);
  assert.deepStrictEqual([entries[0].command, entries[0].cwd, entries[0].exit_code, entries[0].class], ['git log --oneline -1', 'src', 0, 'read']);
  assert.strictEqual(entries[1].error_code, 'SENSITIVE_FILE');
  const raw = fs.readFileSync(b.log.file, 'utf8');
  assert.ok(!raw.includes('console.log') && !raw.includes('gsk_'), 'o log não guarda conteúdo nem secrets');
});

test('W11. configuração: raiz do disco, pasta do usuário, caminho relativo e stateDir dentro do workspace são recusados', () => {
  const p = roots => ({ projects: [{ project_id: 'prj_x', roots, mode: 'read-only' }] });
  assert.throws(() => validateConfig(p([path.parse(ROOT).root])), /raiz do disco/);
  assert.throws(() => validateConfig(p([os.homedir()])), /pasta do usuário/);
  assert.throws(() => validateConfig(p(['projetos/nexia'])), /não é absoluto/);
  assert.throws(() => validateConfig({ stateDir: path.join(ROOT, '.state'), projects: [{ project_id: 'prj_x', roots: [ROOT] }] }), /stateDir/);
  assert.throws(() => validateConfig({ projects: [{ project_id: 'prj_x', roots: [ROOT], mode: 'root' }] }), /mode/);
});

test('W12. MCP por stdio: initialize, tools/list com nomes válidos, chamada, e confirmação por elicitation', async () => {
  const cfgFile = path.join(TMP, 'bridge.json');
  fs.writeFileSync(cfgFile, JSON.stringify({ stateDir: STATE, projects: [{ project_id: 'prj_nexia', name: 'NEXIA OS', roots: [ROOT], mode: 'write-confirm' }] }));
  const child = spawn(process.execPath, [path.join(__dirname, '..', '..', 'nexia-bridge', 'bin', 'nexia-bridge.js'), 'serve'], { env: { ...process.env, NEXIA_BRIDGE_CONFIG: cfgFile }, stdio: ['pipe', 'pipe', 'pipe'] });
  const inbox = [];
  let waiters = [];
  let buf = '';
  child.stdout.on('data', c => {
    buf += c; let i;
    while ((i = buf.indexOf('\n')) >= 0) { const m = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1); inbox.push(m); waiters.forEach(w => w()); }
  });
  const next = pred => new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout MCP')), 10000);
    const check = () => { const k = inbox.findIndex(pred); if (k >= 0) { clearTimeout(t); waiters = waiters.filter(w => w !== check); resolve(inbox.splice(k, 1)[0]); } };
    waiters.push(check); check();
  });
  const send = m => child.stdin.write(`${JSON.stringify(m)}\n`);
  try {
    send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: { elicitation: {} }, clientInfo: { name: 'claude-code', version: 'teste' } } });
    const init = await next(m => m.id === 1);
    assert.deepStrictEqual([init.result.protocolVersion, init.result.serverInfo.name], ['2025-06-18', 'nexia-bridge']);
    send({ jsonrpc: '2.0', method: 'notifications/initialized' });
    send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    const list = await next(m => m.id === 2);
    const names = list.result.tools.map(t => t.name);
    assert.deepStrictEqual(names, ['bridge_projects', 'workspace_list', 'workspace_read', 'workspace_write', 'workspace_delete', 'terminal_run', 'git_status', 'git_diff', 'git_commit']);
    assert.ok(names.every(n => /^[a-zA-Z0-9_-]{1,64}$/.test(n)));
    send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'workspace_read', arguments: { project_id: 'prj_nexia', path: '.env' } } });
    const denied = await next(m => m.id === 3);
    assert.deepStrictEqual([denied.result.isError, denied.result.structuredContent.error.code], [true, 'SENSITIVE_FILE']);

    // escrita: o Bridge pergunta à pessoa pelo cliente (elicitation); recusa → nada gravado
    send({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'workspace_write', arguments: { project_id: 'prj_nexia', path: 'src/mcp.js', content: 'ok\n' } } });
    const ask = await next(m => m.method === 'elicitation/create');
    assert.match(ask.params.message, /gravar src\/mcp\.js/);
    send({ jsonrpc: '2.0', id: ask.id, result: { action: 'decline' } });
    const no = await next(m => m.id === 4);
    assert.strictEqual(no.result.structuredContent.error.code, 'NOT_APPROVED');
    assert.ok(!fs.existsSync(path.join(ROOT, 'src', 'mcp.js')));
    send({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'workspace_write', arguments: { project_id: 'prj_nexia', path: 'src/mcp.js', content: 'ok\n' } } });
    const ask2 = await next(m => m.method === 'elicitation/create');
    send({ jsonrpc: '2.0', id: ask2.id, result: { action: 'accept', content: { aprovar: true } } });
    const yes = await next(m => m.id === 5);
    assert.deepStrictEqual([yes.result.isError, yes.result.structuredContent.status], [false, 'written']);
    assert.strictEqual(fs.readFileSync(path.join(ROOT, 'src', 'mcp.js'), 'utf8'), 'ok\n');
    const last = createLog(STATE).read().at(-1);
    assert.deepStrictEqual([last.agent, last.tool, last.status], ['claude-code', 'workspace_write', 'ok']);
  } finally {
    child.kill();
  }
});

test('W13. redação: SHAs do git ficam; tokens e senhas em URL somem', () => {
  const sha = crypto.randomBytes(20).toString('hex');
  const r = redact(`commit ${sha}\nurl=https://user:${crypto.randomBytes(6).toString('hex')}@host/repo\nkey=${fakeKey()}`);
  assert.ok(r.text.includes(sha));
  assert.match(r.text, /https:\/\/user:\[REDACTED\]@host/);
  assert.ok(!/gsk_[0-9a-f]{10}/.test(r.text));
});
