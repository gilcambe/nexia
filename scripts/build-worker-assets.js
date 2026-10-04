#!/usr/bin/env node
'use strict';
// ADR-FREE-01: monta a pasta de estáticos do Worker (.worker-assets/) com exatamente o que o
// server.js servia: o site React compilado (out/) e as pastas públicas do legado, só com as
// extensões permitidas e sem arquivos ocultos. Nada fora dessas pastas vai para o Cloudflare.
const fs = require('fs');
const path = require('path');
const { PUBLIC_DIRS } = require('../lib/routes');
const { DEFAULT_EXTENSIONS } = require('../lib/safe-path');

const ROOT = path.join(__dirname, '..');
const DEST = path.join(ROOT, '.worker-assets');

function copyTree(src, dest) {
  let n = 0;
  if (!fs.existsSync(src)) return 0;
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    if (ent.name.startsWith('.')) continue;
    const from = path.join(src, ent.name);
    const to = path.join(dest, ent.name);
    if (ent.isDirectory()) { n += copyTree(from, to); continue; }
    if (!ent.isFile() || !DEFAULT_EXTENSIONS.has(path.extname(ent.name).toLowerCase())) continue;
    fs.mkdirSync(dest, { recursive: true });
    fs.copyFileSync(from, to);
    n++;
  }
  return n;
}

function build() {
  if (!fs.existsSync(path.join(ROOT, 'out', 'index.html'))) throw new Error('out/index.html não existe: rode "npm run build" antes.');
  fs.rmSync(DEST, { recursive: true, force: true });
  let total = copyTree(path.join(ROOT, 'out'), DEST);
  for (const dir of PUBLIC_DIRS) total += copyTree(path.join(ROOT, dir), path.join(DEST, dir));
  return total;
}

if (require.main === module) {
  const n = build();
  console.log(`[worker-assets] ${n} arquivos em .worker-assets/`);
}

module.exports = { build, DEST };
