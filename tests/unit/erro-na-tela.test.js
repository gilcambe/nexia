'use strict';
// 12/11/2026: a página não pode ficar preta quando uma tela quebra (Central só mostrava "Feito com Kernex").
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..', '..');
const ler = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');

test('ENT1. todas as rotas passam pela proteção ErroNaTela', () => {
  const r = ler('src/router/index.tsx');
  assert.match(r, /import ErroNaTela from "\.\.\/components\/ErroNaTela"/);
  assert.match(r, /<ErroNaTela><Suspense/);
});

test('ENT2. a proteção mostra o motivo e Recarregar, e recarrega sozinha só uma vez quando é arquivo velho', () => {
  const c = ler('src/components/ErroNaTela/index.tsx');
  assert.match(c, /getDerivedStateFromError/);
  assert.match(c, /Recarregar/);
  assert.match(c, /sessionStorage\.getItem\(CHAVE\)/, 'só uma vez, para não ficar em laço');
  assert.match(c, /dynamically imported module/);
});
