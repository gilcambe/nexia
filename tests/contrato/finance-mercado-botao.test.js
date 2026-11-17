'use strict';
// Contrato: Kernex Finance — Mercado: o botão "Remover" de cada cartão sai BRANCO (estilo padrão do navegador) no
// tema escuro (visto na prévia, #3915). Pedido, no CSS injetado por prumo/mercado.js (<style id="mk-estilo">):
//  - .mk-card [data-remover] { background: none (ou transparent); border: 1px solid var(--borda); color: var(--fraco);
//    border-radius: 8px; font-size: 13px; padding: 4px 8px; cursor: pointer; align-self: flex-start; }
//  - .mk-card { border-radius: 14px; padding: 12px; } (cantos e respiro iguais aos outros cartões do app)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const m = fs.readFileSync(path.join(__dirname, '../../prumo/mercado.js'), 'utf8');
const regra = (sel) => { const i = m.indexOf(sel + ' {'); if (i < 0) return ''; const a = m.indexOf('{', i); return m.slice(a + 1, m.indexOf('}', a)); };

test('botão Remover no tema escuro (sem o branco do navegador)', () => {
  const b = regra('.mk-card [data-remover]');
  assert.ok(b, 'regra .mk-card [data-remover] { ... } no CSS de mk-estilo');
  assert.match(b, /background\s*:\s*(none|transparent)/);
  assert.match(b, /border\s*:\s*1px solid var\(--borda\)/);
  assert.match(b, /color\s*:\s*var\(--fraco\)/);
  assert.match(b, /border-radius\s*:\s*8px/);
});

test('cartão com cantos e respiro dos outros cartões', () => {
  const c = regra('.mk-card');
  assert.match(c, /border-radius\s*:\s*14px/);
  assert.match(c, /padding\s*:\s*12px/);
});
