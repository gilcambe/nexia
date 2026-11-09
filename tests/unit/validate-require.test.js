const { execFile } = require('child_process');
const path = require('path');
const assert = require('assert');

describe('validate-require CLI', () => {
  const script = path.resolve(__dirname, '../../scripts/validate-require.js');
  const badFile = path.resolve(__dirname, '../fixtures/bad-require.js');
  const goodFile = path.resolve(__dirname, '../fixtures/good-require.js');

  it('should exit with code 1 and report error for a file with bad require', (done) => {
    execFile('node', [script, badFile], (error, stdout, stderr) => {
      // `error` is populated when the child exits with a non‑zero code
      assert(error, 'Expected an error because the script should exit non‑zero');
      assert.strictEqual(error.code, 1, 'Exit code should be 1');
      assert.match(stderr, /Error requiring/);
      done();
    });
  });

  it('should exit with code 0 for a valid file', (done) => {
    execFile('node', [script, goodFile], (error, stdout, stderr) => {
      assert.ifError(error);
      assert.match(stdout, /All files required successfully/);
      done();
    });
  });
});
