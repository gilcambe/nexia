'use strict';
// Classificação de comandos do terminal.run (spec §8: "Comandos perigosos devem ser
// bloqueados ou pedir aprovação", "Permitir denylist/allowlist de comandos").
// O comando nunca passa por shell: executável + lista de argumentos (spawn sem shell),
// então ; && | > $() não têm efeito. Classes:
//   read      leitura (git status/diff/log..., ls, versões)
//   test      testes, lint, typecheck e build do projeto (risco LOW na spec §15)
//   write     qualquer outro comando permitido
//   dangerous destrutivo ou execução arbitrária (shell, -e/-c, reset --hard, push --force, rm -r)
//   denied    nunca roda pelo Bridge (deploy/publicação, privilégio, disco, o próprio Bridge)
const path = require('path');
const { isSensitive } = require('./sensitive');

const strip = exe => path.basename(String(exe)).toLowerCase().replace(/\.(exe|cmd|bat|ps1)$/, '');

const DENIED_EXE = new Set(['sudo', 'su', 'doas', 'runas', 'pkexec', 'shutdown', 'reboot', 'poweroff', 'halt', 'init',
  'mkfs', 'fdisk', 'diskpart', 'format', 'dd', 'bcdedit', 'reg', 'regedit', 'netsh', 'iptables', 'crontab', 'schtasks',
  'nexia-bridge', 'ssh', 'scp', 'sftp', 'rsync', 'nc', 'ncat', 'netcat', 'telnet']);
const SHELLS = new Set(['sh', 'bash', 'zsh', 'fish', 'dash', 'ksh', 'csh', 'tcsh', 'cmd', 'powershell', 'pwsh', 'wsl']);
const INTERPRETERS = { node: ['-e', '--eval', '-p', '--print'], python: ['-c'], python3: ['-c'], py: ['-c'], ruby: ['-e'], perl: ['-e', '-E'], php: ['-r'], deno: ['eval'], bun: ['-e', '--eval'] };
// Deploy/publicação passam pelo pipeline (Fase 9) e pelas aprovações, nunca pelo terminal.
const DEPLOY = [
  ['firebase', a => a.includes('deploy') || a.includes('hosting:channel:deploy')],
  ['wrangler', a => a.includes('deploy') || a.includes('publish') || (a.includes('pages') && a.includes('deploy')) || a.includes('secret')],
  ['vercel', a => a.includes('--prod') || a.includes('deploy') || a.length === 0],
  ['netlify', a => a.includes('deploy')],
  ['npm', a => a[0] === 'publish' || a[0] === 'unpublish' || a[0] === 'adduser' || a[0] === 'login' || a[0] === 'token'],
  ['yarn', a => a[0] === 'publish' || a[0] === 'npm'],
  ['pnpm', a => a[0] === 'publish'],
  ['gh', a => ['secret', 'auth', 'release', 'repo'].includes(a[0]) && !['view', 'list'].includes(a[1])],
  ['gcloud', () => true], ['aws', () => true], ['az', () => true], ['kubectl', () => true], ['terraform', a => ['apply', 'destroy', 'import'].includes(a[0])],
  ['git', a => a[0] === 'config' && a.some(x => /credential|url\..*insteadof/i.test(x))],
];
const GIT_READ = new Set(['status', 'diff', 'log', 'show', 'branch', 'rev-parse', 'ls-files', 'blame', 'describe', 'shortlog', 'remote', 'tag']);
const READ_EXE = new Set(['ls', 'dir', 'pwd', 'tree', 'wc', 'which', 'where', 'whoami', 'echo']);
const TEST_SCRIPTS = /^(test|test:.+|lint|lint:.+|typecheck|check|build|format:check)$/;

/**
 * @param {string} command  executável
 * @param {string[]} args
 * @param {{ allow?: string[], deny?: string[] }} lists  listas extras do config (nome do executável)
 * @returns {{ cls: 'read'|'test'|'write'|'dangerous'|'denied', reason: string }}
 */
function classify(command, args = [], lists = {}) {
  const exe = strip(command);
  const a = args.map(String);
  const al = a.map(x => x.toLowerCase());
  if ((lists.deny || []).map(strip).includes(exe)) return { cls: 'denied', reason: `${exe} está na denylist do projeto.` };
  if (DENIED_EXE.has(exe)) return { cls: 'denied', reason: `${exe} nunca roda pelo Bridge.` };
  const dep = DEPLOY.find(([e, f]) => e === exe && f(al));
  if (dep) return { cls: 'denied', reason: `${exe} ${a.slice(0, 2).join(' ')}: deploy, publicação e credenciais passam pelo pipeline com aprovação, não pelo terminal.` };
  // Argumento que aponta para arquivo sensível (.env, chave...) nunca é aceito
  if (a.some(x => isSensitive(x.replace(/^[^=]*=/, '')))) return { cls: 'denied', reason: 'Argumento aponta para arquivo sensível (.env, chave, credencial ou .git).' };

  if (SHELLS.has(exe)) return { cls: 'dangerous', reason: `${exe} executa comandos arbitrários.` };
  if (INTERPRETERS[exe] && al.some(x => INTERPRETERS[exe].includes(x))) return { cls: 'dangerous', reason: `${exe} ${a.find(x => INTERPRETERS[exe].includes(x.toLowerCase()))} executa código arbitrário.` };
  if (exe === 'npx' && !(al[0] === 'tsc' || al[0] === 'eslint' || al[0] === 'prettier' || al[0] === 'vitest' || al[0] === 'jest' || al[0] === 'playwright')) return { cls: 'dangerous', reason: 'npx baixa e executa pacotes.' };
  if (['rm', 'rmdir', 'del', 'rd', 'shred', 'unlink'].includes(exe) && (al.some(x => /^-[a-z]*r|^-[a-z]*f|^\/s$|^\/q$|^--recursive$|^--force$/.test(x)) || exe !== 'rm')) {
    return { cls: 'dangerous', reason: `${exe} com remoção recursiva/forçada.` };
  }
  if (exe === 'chmod' || exe === 'chown' || exe === 'icacls' || exe === 'takeown') return { cls: 'dangerous', reason: `${exe} altera permissões.` };
  if (exe === 'git') {
    const sub = al[0];
    if (sub === 'push' && al.some(x => x === '--force' || x === '-f' || x.startsWith('--force-with-lease') || x.startsWith('+'))) return { cls: 'dangerous', reason: 'git push forçado.' };
    if (sub === 'reset' && al.includes('--hard')) return { cls: 'dangerous', reason: 'git reset --hard descarta alterações.' };
    if (sub === 'clean') return { cls: 'dangerous', reason: 'git clean apaga arquivos não versionados.' };
    if (sub === 'filter-branch' || sub === 'filter-repo' || (sub === 'rebase' && al.includes('-i'))) return { cls: 'dangerous', reason: 'Reescrita de histórico.' };
    if ((sub === 'checkout' || sub === 'restore') && al.includes('.')) return { cls: 'dangerous', reason: 'Descarta alterações locais.' };
    if (GIT_READ.has(sub) && !(sub === 'branch' && al.some(x => /^-[dDmMcC]$|^--delete$|^--move$/.test(x))) && !(sub === 'remote' && al[1] && al[1] !== '-v' && al[1] !== 'show') && !(sub === 'tag' && al.length > 1 && !al.includes('-l') && !al.includes('--list'))) {
      return { cls: 'read', reason: `git ${sub} só lê.` };
    }
    return { cls: 'write', reason: `git ${sub} altera o repositório.` };
  }
  if ((lists.allow || []).map(strip).includes(exe)) return { cls: 'write', reason: `${exe} liberado pelo projeto (ainda segue o modo).` };
  if (READ_EXE.has(exe)) return { cls: 'read', reason: `${exe} só lê.` };
  if ((exe === 'node' || exe === 'npm' || exe === 'git' || exe === 'python' || exe === 'python3') && al.length === 1 && (al[0] === '--version' || al[0] === '-v')) return { cls: 'read', reason: 'versão.' };
  if ((exe === 'npm' || exe === 'pnpm' || exe === 'yarn') && (al[0] === 'test' || al[0] === 't' || (al[0] === 'run' && TEST_SCRIPTS.test(a[1] || '')))) return { cls: 'test', reason: `${exe} ${a.slice(0, 2).join(' ')}: testes/build do projeto.` };
  if (exe === 'npx' || exe === 'pytest' || (exe === 'go' && al[0] === 'test') || (exe === 'cargo' && ['test', 'check', 'build', 'clippy'].includes(al[0]))) return { cls: 'test', reason: `${exe}: testes/verificação.` };
  return { cls: 'write', reason: `${exe} pode alterar arquivos.` };
}

module.exports = { classify, strip };
