'use strict';
// Roda a suíte de testes unitários do projeto: o mesmo comando do "npm test"
// (node --test tests/unit/*.test.js). Serve para conferir na mão, sem digitar o script inteiro.
//
// Uso: node run-test.js
// O CI (".github/workflows/ci.yml") roda o "npm test" direto; este arquivo é só o atalho local.
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const resultado = spawnSync(npm, ['test'], {
  cwd: path.resolve(__dirname),
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (resultado.error) {
  console.error('Não deu para rodar o npm test:', resultado.error.message);
  process.exit(1);
}

process.exit(typeof resultado.status === 'number' ? resultado.status : 1);
