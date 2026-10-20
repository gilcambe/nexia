'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { renderizar } = require('../../scripts/renderizar-site');

test('SPLASH1. renderiza Splash Eventos com o renderizador real e confirma título e selo', () => {
  const jsonPath = path.join(__dirname, '../../clientes/splash/site.json');
  const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const tmpDir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'splash-test-'));

  const r = renderizar(raw, tmpDir, {});
  assert.strictEqual(r.spec.name, 'Splash Eventos');

  const html = fs.readFileSync(path.join(tmpDir, 'index.html'), 'utf8');
  assert.ok(html.includes('<title>Splash Eventos'), 'HTML deve conter o título "Splash Eventos"');
  assert.ok(html.includes('Feito com Kernex'), 'HTML deve conter o selo "Feito com Kernex"');
  assert.ok(html.includes('utm_source=splash&amp;utm_medium=selo') || html.includes('utm_source=splash&utm_medium=selo'), 'HTML deve conter o link do selo');
});
