'use strict';
// #3556 (13/11/2026): Kernex Finance no domínio KERNEX; o dono nunca vê "prumo" nem "nexia".
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const RAIZ = path.join(__dirname, '..', '..');
const ler = (f) => fs.readFileSync(path.join(RAIZ, f), 'utf8');

test('KF1. finance.kernex.com.br abre o app (/prumo/) e é host KERNEX', () => {
  const app = ler('cloudflare/app.js');
  assert.match(app, /'finance\.kernex\.com\.br': '\/prumo\/'/);
  const { KERNEX_HOSTS } = require('../../cloudflare/app.js');
  assert.ok(KERNEX_HOSTS.includes('finance.kernex.com.br'));
});

test('KF2. a Central lista o Kernex Finance com o endereço novo', () => {
  const { PRODUTOS } = require('../../central/produtos.js');
  const f = PRODUTOS.find((p) => p.id === 'finance');
  assert.ok(f, 'Kernex Finance na Central');
  assert.equal(f.site, 'https://finance.kernex.com.br/');
  assert.doesNotMatch(f.nome + f.frase, /prumo|nexia/i);
});

test('KF3. nenhum texto visível do app diz Prumo/Nexia; nome do app é Kernex Finance; endereço antigo avisa o novo', () => {
  for (const f of ['prumo/index.html', 'prumo/landing.html']) {
    const visivel = ler(f).replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ');
    assert.doesNotMatch(visivel, /\b(prumo|nexia)\b/i, f);
  }
  const m = JSON.parse(ler('prumo/manifest.webmanifest'));
  assert.equal(m.name, 'Kernex Finance');
  assert.match(ler('prumo/index.html'), /Novo endereço: <a href="https:\/\/finance\.kernex\.com\.br\/"/);
});
