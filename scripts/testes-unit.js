#!/usr/bin/env node
'use strict';
// Roda tests/unit/*.test.js igual em Linux e Windows (#3557).
// O cmd do Windows não expande "*" e o Node 20 não faz glob sozinho; então a lista sai daqui.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const pasta = path.join(__dirname, '..', 'tests', 'unit');
const arquivos = fs.readdirSync(pasta).filter((f) => f.endsWith('.test.js')).sort()
  .map((f) => path.join('tests', 'unit', f));
const r = spawnSync(process.execPath, ['--test', ...process.argv.slice(2), ...arquivos], { stdio: 'inherit', cwd: path.join(__dirname, '..') });
process.exit(r.status === null ? 1 : r.status);
