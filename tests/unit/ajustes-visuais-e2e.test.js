'use strict';
// Achados do teste de pessoa (celular 390x844), 19/10.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const ler = (p) => fs.readFileSync(path.join(__dirname, '..', '..', p), 'utf8');

test('Central: "há 1 dia" no singular', () => {
  const api = ler('src/pages/central/api.ts');
  assert.match(api, /d === 1 \? "dia" : "dias"/);
  assert.doesNotMatch(api, /return `há \$\{Math\.round\(h \/ 24\)\} dias`/);
});

test('Body Coach Pix: selo "economize" não cobre o nome do plano e o cupom mostra o texto normal', () => {
  const pix = ler('apps/body-coach/src/components/feature/PagarPix.tsx');
  assert.match(pix, /px-2 pb-2 pt-5 text-center/);
  assert.match(pix, /placeholder="Tenho um cupom ou convite"[^>]*placeholder:normal-case/);
});
