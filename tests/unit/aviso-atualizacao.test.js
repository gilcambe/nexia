// #2917: aviso de atualização e fim do SW antigo que deixava o app Kernex velho.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const ler = (p) => fs.readFileSync(require('path').join(__dirname, '..', '..', p), 'utf8');

test('SW antigo /sw.js aposentado: não intercepta fetch e se desregistra', () => {
  const s = ler('public/sw.js');
  assert.doesNotMatch(s, /addEventListener\(["']fetch/);
  assert.match(s, /unregister\(\)/);
  assert.match(s, /cortex-cache-v1/);
  assert.doesNotMatch(ler('core/nexia-engine.js'), /register\(['"]\/sw\.js['"]\)/);
});

test('Cortex e Central esperam o toque em Atualizar e buscam rede primeiro', () => {
  for (const f of ['public/cortex-sw.js', 'public/central-sw.js']) {
    const s = ler(f);
    assert.match(s, /tipo === "atualizar"\) self\.skipWaiting\(\)/, f);
    assert.doesNotMatch(s, /"install", \(\) => self\.skipWaiting\(\)/, f);
    assert.doesNotMatch(s, /return guardado \|\| rede/, f);
  }
});

test('banner de atualização existe e está ligado no app', () => {
  const b = ler('public/js/update-banner.js');
  assert.match(b, /Tem atualização nova/);
  assert.match(b, /postMessage\(\{ tipo: "atualizar" \}\)/);
  assert.match(b, /controllerchange/);
  assert.match(ler('index.html'), /\/js\/update-banner\.js/);
});
