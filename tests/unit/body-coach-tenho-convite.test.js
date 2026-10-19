'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, '..', '..', 'apps', 'body-coach', 'src');
const ler = (p) => fs.readFileSync(path.join(SRC, p), 'utf8');

test('"tenho um convite": campo no cadastro e o mesmo código vale no Pix', () => {
  const auth = ler('pages/auth/page.tsx');
  assert.match(auth, /Tenho um convite/);
  assert.match(auth, /aria-label="Código do convite"/);
  // guardado no envio do cadastro e no Google
  assert.equal((auth.match(/guardarCodigoDigitado\(convite\)/g) || []).length, 2);
  const ac = ler('lib/acesso.ts');
  assert.match(ac, /export function guardarCodigoDigitado/);
  assert.match(ac, /setItem\('bc_convite', c\)/); // código de coach digitado entra na equipe
  const pix = ler('components/feature/PagarPix.tsx');
  assert.match(pix, /if \(c\.dias\) \{ const r = await usarCupom/);
  assert.match(pix, /Tenho um cupom ou convite/);
});
