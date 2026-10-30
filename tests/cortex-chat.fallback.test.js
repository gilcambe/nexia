const assert = require('assert');
const { describe, it } = require('node:test');
const { mockProviders } = require('./cortex-chat.mock');

describe('cortex-chat.fallback.test.js', () => {
  it('should fallback to the next provider when the first provider responds with 429', async () => {
    const providers = mockProviders([
      { status: 429, response: { error: 'Too Many Requests' } },
      { status: 200, response: { message: 'Success from fallback provider' } }
    ]);

    const response = await providers[0].fetch('https://api.example.com/chat', {
      method: 'POST',
      body: JSON.stringify({ message: 'Hello' })
    });

    assert.strictEqual(response.status, 200);
    const data = await response.json();
    assert.deepStrictEqual(data, { message: 'Success from fallback provider' });
  });

  it('should throw an error if all providers fail', async () => {
    const providers = mockProviders([
      { status: 429, response: { error: 'Too Many Requests' } },
      { status: 500, response: { error: 'Internal Server Error' } }
    ]);

    await assert.rejects(
      providers[0].fetch('https://api.example.com/chat', {
        method: 'POST',
        body: JSON.stringify({ message: 'Hello' })
      }),
      { message: 'All providers failed' }
    );
  });
});
