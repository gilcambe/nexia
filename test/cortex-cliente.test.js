import { unstable_dev } from 'wrangler';
import { describe, before, after, it } from 'node:test';
import assert from 'node:assert';
import jwt from 'jsonwebtoken';

const TEST_KEY = 'test-key';
const UID_A = 'uidA';
const UID_B = 'uidB';

function createToken(uid) {
  return jwt.sign({ uid }, TEST_KEY, { expiresIn: '1h' });
}

describe('Cortex Cliente Authorization Tests', () => {
  let worker;

  before(async () => {
    worker = await unstable_dev('cloudflare/app.js', {
      experimental: { disableExperimentalWarning: true },
      vars: { JWT_SECRET: TEST_KEY },
    });
  });

  after(async () => {
    await worker.stop();
  });

  it('should return 200 for correct access with uidA', async () => {
    const token = createToken(UID_A);
    const response = await worker.fetch('/api/cortex-cliente/conversas', {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.strictEqual(response.status, 200);
    const data = await response.json();
    assert.ok(data.some(item => item.uid === UID_A));
  });

  it('should return 403 for access to another uid (uidB)', async () => {
    const token = createToken(UID_B);
    const response = await worker.fetch('/api/cortex-cliente/conversas', {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.strictEqual(response.status, 403);
  });

  it('should return 401 for no token', async () => {
    const response = await worker.fetch('/api/cortex-cliente/conversas');
    assert.strictEqual(response.status, 401);
  });
});
