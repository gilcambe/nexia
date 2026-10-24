'use strict';
// Body Coach sem rolar, parte 3 do aluno (pedido do usuário em 24/10/2026): Guia, Respirar, Exames, Ferramentas e Loja.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC = path.join(__dirname, '..', '..', 'apps', 'body-coach', 'src');
const ler = (f) => fs.readFileSync(path.join(SRC, f), 'utf8');

test('Guia, Respirar, Exames, Ferramentas e Loja cabem numa tela: grades, abas e uma parte por vez', () => {
  const guia = ler('pages/guia/page.tsx');
  assert.match(guia, /role="tablist" aria-label="Partes do guia"/);
  assert.match(guia, /Rever o tour/);
  const resp = ler('pages/breathe/page.tsx');
  assert.match(resp, /grid grid-cols-3 gap-1\.5" role="radiogroup"/);
  const ex = ler('pages/exams/page.tsx');
  assert.match(ex, /useAba\(ABAS\.map\(\(a\) => a\.id\), 'enviar'\)/);
  assert.match(ex, /setAba\('meus'\)/, 'depois de enviar, mostra a lista');
  assert.match(ler('pages/exams/components/BloodMarkers.tsx'), /grid grid-cols-2 gap-2/);
  const fer = ler('pages/ferramentas/page.tsx');
  assert.match(fer, /const ABAS_FERRAMENTAS = \[/);
  assert.match(fer, /grid grid-cols-4 gap-1\.5/);
  assert.match(fer, /MAIS_TELAS\.map/, 'as telas que saíram do menu continuam a um toque');
  const loja = ler('pages/ferramentas/Loja.tsx');
  for (const p of ["parte === 'ofertas'", "parte === 'voce'", "parte === 'catalogo'"]) assert.ok(loja.includes(p), p);
  assert.doesNotMatch(ler('pages/ferramentas/OfertasDoDia.tsx'), /a NEXIA pode/);
});
