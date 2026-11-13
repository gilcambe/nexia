'use strict';
// #2382: Sentinela (sites no ar + CI da develop).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const s = require('../../scripts/sentinel.js');

test('SE1. só confere sites próprios, sem repetir', () => {
  const r = s.sitesParaConferir([
    { id: 'a', nome: 'A', site: 'https://a.pages.dev/' }, { id: 'b', nome: 'B', site: 'https://a.pages.dev/' },
    { id: 'i', nome: 'Insta', site: 'https://www.instagram.com/kernex_bodycoach' }, { id: 'x', nome: 'X' },
  ]);
  assert.deepEqual(r.map((x) => x.id), ['a']);
});

test('SE2. site com erro 5xx nas 2 tentativas = fora; 4xx = no ar', async () => {
  let n = 0;
  const fora = await s.conferirSite({ nome: 'A', url: 'https://a/' }, async () => { n++; return { status: 503 }; });
  assert.equal(n, 2); assert.match(fora.motivo, /503/);
  assert.equal(await s.conferirSite({ nome: 'B', url: 'https://b/' }, async () => ({ status: 401 })), null);
  const caiu = await s.conferirSite({ nome: 'C', url: 'https://c/' }, async () => { throw new Error('ECONNREFUSED'); });
  assert.match(caiu.motivo, /não respondeu/);
});

test('SE3. CI quebrado só olha a última execução terminada', () => {
  assert.equal(s.ciQuebrado([{ status: 'in_progress' }, { status: 'completed', conclusion: 'success' }]), null);
  assert.ok(s.ciQuebrado([{ status: 'completed', conclusion: 'failure', html_url: 'u' }]));
  assert.match(s.montarRelatorio([{ nome: 'A', motivo: 'm' }], '2026-11-13T10:00'), /\*\*A\*\*: m/);
});

test('SE4. workflow roda a cada 30 min, só com GITHUB_TOKEN', () => {
  const y = fs.readFileSync(path.join(__dirname, '../../.github/workflows/sentinel.yml'), 'utf8');
  assert.match(y, /\*\/30 \* \* \* \*/);
  assert.match(y, /workflow_dispatch/);
  assert.doesNotMatch(y, /secrets\.(?!GITHUB_TOKEN)/);
});
