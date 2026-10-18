'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { situacao, publicar } = require('../../netlify/functions/central/pedidos-publicar.js');

const falso = (log, { emAndamento = false } = {}) => async (c, i = {}) => {
  log.push([i.method || 'GET', c]);
  if (c.includes('/runs?status=success')) return { workflow_runs: [{ head_sha: 'abc', updated_at: 't', html_url: 'u' }] };
  if (c.includes('/runs?per_page=1')) return { workflow_runs: [{ status: emAndamento ? 'in_progress' : 'completed', conclusion: 'success' }] };
  if (c.includes('/compare/')) return { ahead_by: 2, commits: [{ commit: { message: 'um\ncorpo' } }, { commit: { message: 'dois' } }] };
  return {};
};

test('PUB1. mostra quantas mudanças ainda não estão no ar', async () => {
  const s = await situacao(falso([]));
  assert.strictEqual(s.mudancas, 2);
  assert.deepStrictEqual(s.titulos, ['dois', 'um']);
  assert.strictEqual(s.emAndamento, false);
});

test('PUB2. publicar dispara o Deploy Cloudflare com DEPLOY', async () => {
  const log = [];
  const r = await publicar(falso(log));
  assert.strictEqual(r.status, 200);
  assert.ok(log.some((l) => l[0] === 'POST' && l[1].endsWith('/deploy-cloudflare.yml/dispatches')));
});

test('PUB3. não publica por cima de uma publicação em andamento', async () => {
  const log = [];
  const r = await publicar(falso(log, { emAndamento: true }));
  assert.strictEqual(r.status, 400);
  assert.ok(!log.some((l) => l[0] === 'POST'));
});
