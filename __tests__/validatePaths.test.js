const test = require('node:test');
const assert = require('node:assert');
const { validatePaths } = require('../scripts/validatePaths');

test('validatePaths with valid existing path', () => {
  const result = validatePaths(['package.json']);
  assert.strictEqual(result, true);
});

test('validatePaths with non-existent path throws error', () => {
  assert.throws(() => {
    validatePaths(['non-existent-file-xyz-123.js']);
  }, /Task aborted: requested paths do not exist/);
});
