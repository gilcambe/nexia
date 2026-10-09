'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { renderizar } = require('../../scripts/renderizar-site');
const kit = require('../../nexia-ai/site-kit');
const { checkWebFiles } = require('../../nexia-ai/orchestrator/web-check');

test('RS1. o spec de exemplo dos clientes vira site completo que passa na checagem de qualidade', () => {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '../../clientes/exemplo/site.json'), 'utf8'));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'site-'));
  const { spec: prev } = kit.normalizeSpec(raw, { kind: 'site' });
  const media = {};
  kit.mediaQueries(prev).forEach((q, k) => { if (q.kind !== 'video') media[q.slot] = { url: `https://img.test/${k}.jpg`, width: 1600, height: 1067, alt: `foto ${k}`, credit: `Foto ${k} (CC BY)`, provider: 'openverse' }; });
  const { spec, escritos } = renderizar(raw, dir, media);
  assert.ok(escritos.includes('index.html') && escritos.includes('styles.css'));
  assert.ok(fs.readFileSync(path.join(dir, 'index.html'), 'utf8').includes(spec.name));
  const files = escritos.map(p => ({ path: `x/${p}`, content: fs.readFileSync(path.join(dir, p), 'utf8') }));
  const r = checkWebFiles(files, { design: 'site', added: new Set(files.map(f => f.path)) });
  assert.deepStrictEqual(r.errors, []);
  assert.ok(kit.qualityCheck);
});

test('RS2. spec inválido não gera nada', () => {
  assert.throws(() => renderizar({ sections: [] }, os.tmpdir()), /inválido/);
});

test('RS3. todo site de cliente leva o selo "Feito com NEXIA" no rodapé', () => {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '../../clientes/exemplo/site.json'), 'utf8'));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'site-'));
  renderizar(raw, dir);
  assert.match(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), /class="selo-nexia"[^>]*>Feito com NEXIA</);
});
