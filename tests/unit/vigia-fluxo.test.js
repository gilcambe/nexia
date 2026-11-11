'use strict';
// Vigia do fluxo: só repete falha de AMBIENTE, uma vez, e nunca publicação em produção.
const test = require('node:test');
const assert = require('node:assert/strict');
const { eAmbiente, podeRepetir } = require('../../scripts/vigia-fluxo');
const AGORA = Date.parse('2026-11-11T16:00:00Z');
const run = o => ({ name: 'CI', conclusion: 'failure', run_attempt: 1, updated_at: '2026-11-11T15:30:00Z', ...o });

test('VF1. reconhece as falhas de ambiente reais de hoje; falha de código não', () => {
  assert.equal(eAmbiente("E: Failed to fetch https://security.ubuntu.com/... Temporary failure resolving 'azure.archive.ubuntu.com'"), true);
  assert.equal(eAmbiente('Error: Installation process exited with code: 100'), true);
  assert.equal(eAmbiente('npm error code E503'), true);
  assert.equal(eAmbiente('AssertionError [ERR_ASSERTION]: Expected values to be strictly equal'), false);
  assert.equal(eAmbiente("error TS2322: Type 'string' is not assignable"), false);
});

test('VF2. repete só uma vez, só recente e nunca deploy/produção', () => {
  assert.equal(podeRepetir(run(), AGORA), true);
  assert.equal(podeRepetir(run({ run_attempt: 2 }), AGORA), false);
  assert.equal(podeRepetir(run({ name: 'Deploy Cloudflare' }), AGORA), false);
  assert.equal(podeRepetir(run({ updated_at: '2026-11-11T10:00:00Z' }), AGORA), false);
  assert.equal(podeRepetir(run({ conclusion: 'cancelled' }), AGORA), false);
});
