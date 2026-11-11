const test = require('node:test');
const assert = require('node:assert');
const { validatePaths } = require('../../scripts/validatePaths');

test('validates paths with existing file (package.json)', () => {
  const result = validatePaths(['package.json']);
  assert.strictEqual(result, true);
});

test('throws error when path does not exist', () => {
  assert.throws(() => {
    validatePaths(['non-existent-file-xyz-123.js']);
  }, /Task aborted: requested paths do not exist/);
});
