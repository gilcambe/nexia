'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { resolveFunctionName } = require('../../lib/routes.js');

test('ROT1. /api/pedidos e /api/central chegam nas suas funções (com query)', () => {
  assert.strictEqual(resolveFunctionName('/api/pedidos'), 'pedidos');
  assert.strictEqual(resolveFunctionName('/api/central'), 'central');
});
