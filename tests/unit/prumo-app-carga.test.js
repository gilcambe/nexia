'use strict';
// Incidente 17/11 (#3944): app.js recriava window.MB = { ... } e apagava MB.criarCacheApi (de cache-api.js, carregado
// antes); a linha seguinte quebrava e iniciar() nunca rodava -> Finance com tela vazia. Este teste CARREGA os scripts
// do index.html na ordem, num ambiente falso, e exige que app.js rode até o fim (chega em iniciar()).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const dir = path.join(__dirname, '../../prumo');
function elemento() {
  const e = { style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, hidden: false, textContent: '', innerHTML: '', value: '',
    setAttribute() {}, getAttribute: () => null, addEventListener() {}, removeEventListener() {}, appendChild: (x) => x, querySelector: () => elemento(), querySelectorAll: () => [], closest: () => null, focus() {}, click() {}, remove() {} };
  return e;
}

test('scripts do index.html carregam em ordem e app.js chega a iniciar() sem erro', async () => {
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  const locais = [...html.matchAll(/<script src="\/prumo\/([\w-]+\.js)"><\/script>/g)].map((m) => m[1]);
  const ate = locais.indexOf('app.js');
  assert.ok(ate >= 0, 'index.html carrega /prumo/app.js');
  let pediuConfig = false;
  const document = { getElementById: () => elemento(), querySelector: () => elemento(), querySelectorAll: () => [], createElement: () => elemento(), addEventListener() {}, body: elemento(), head: elemento(), documentElement: elemento(), readyState: 'complete' };
  const window = { location: { hostname: 'localhost', search: '', hash: '' }, addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) };
  const ctx = { window, document, console, setTimeout, clearTimeout, localStorage: { getItem: () => null, setItem() {} }, navigator: {}, location: window.location,
    fetch: async (u) => { if (String(u).includes('firebase-config')) pediuConfig = true; return { ok: false, json: async () => ({}) }; },
    firebase: { apps: [], initializeApp() {}, auth: () => ({ onAuthStateChanged() {} }) } };
  ctx.self = ctx.window;
  vm.createContext(ctx);
  // window e o global são o mesmo objeto, como no navegador.
  vm.runInContext('window = this;', ctx);
  for (const f of locais.slice(0, ate + 1)) {
    assert.doesNotThrow(() => vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f }), `${f} carrega sem erro`);
  }
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(pediuConfig, 'app.js chegou em iniciar() (pediu /api/firebase-config)');
  assert.equal(typeof ctx.MB.api, 'function', 'MB.api existe');
});
