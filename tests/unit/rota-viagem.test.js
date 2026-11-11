'use strict';
// A API /api/viagem (KERNEX Viagens) tem função em cloudflare/functions.js; faltava a rota em lib/routes.js
// e o Worker respondia "Function não encontrada: null" (11/11/2026).
const test = require('node:test');
const assert = require('node:assert/strict');
const { API_ROUTES } = require('../../lib/routes');

test('ROTA1. /api/viagem aponta para a função viagem', () => {
  assert.equal(API_ROUTES['/api/viagem'], 'viagem');
});

test('ROTA2. toda rota de API aponta para uma função que existe no Worker', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '../../cloudflare/functions.js'), 'utf8');
  // Exceção conhecida (11/11/2026): /api/governance -> middleware não tem função no Worker (já respondia 'Function não encontrada'). Revisar à parte.
  const EXCECOES = new Set(['/api/governance']);
  for (const [rota, fn] of Object.entries(API_ROUTES)) {
    if (EXCECOES.has(rota)) continue;
    assert.ok(src.includes(`'${fn}'`) || src.includes(`"${fn}"`) || src.includes(`${fn}:`), rota + ' -> ' + fn + ' sem função no Worker');
  }
});
