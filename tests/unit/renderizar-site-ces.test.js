'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { renderizar } = require('../../scripts/renderizar-site');

test('CES1. renderiza CES Brasil 2027 com o renderizador real e confirma estrutura e selo', () => {
  const jsonPath = path.join(__dirname, '../../clientes/ces2027/site.json');
  const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const tmpDir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'ces-test-'));

  const r = renderizar(raw, tmpDir, {});
  assert.strictEqual(r.spec.name, 'CES Brasil 2027');

  const html = fs.readFileSync(path.join(tmpDir, 'index.html'), 'utf8');
  assert.ok(html.includes('<title>CES Brasil 2027'), 'HTML deve conter o título "CES Brasil 2027"');
  assert.ok(html.includes('Feito com Kernex'), 'HTML deve conter o selo "Feito com Kernex"');
  assert.ok(html.includes('utm_source=ces2027&amp;utm_medium=selo') || html.includes('utm_source=ces2027&utm_medium=selo'), 'HTML deve conter o link do selo');
});
