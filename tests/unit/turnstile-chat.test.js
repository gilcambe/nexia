// tests/unit/turnstile-chat.test.js
import test from "node:test";
import assert from "node:assert";
import { handleTurnstileValidate } from "../../src/api/turnstileValidate.js";

test("Turnstile validate endpoint - valid token", async () => {
  const req = {
    body: { token: "valid-token-test" },
    headers: {}
  };
  let statusCode = 200;
  let jsonResponse = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      jsonResponse = data;
      return this;
    }
  };

  await handleTurnstileValidate(req, res);
  assert.strictEqual(statusCode, 200);
  assert.strictEqual(jsonResponse.success, true);
});

test("Turnstile validate endpoint - invalid token returns 403", async () => {
  const req = {
    body: { token: "invalid-token" },
    headers: {}
  };
  let statusCode = 200;
  let jsonResponse = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      jsonResponse = data;
      return this;
    }
  };

  await handleTurnstileValidate(req, res);
  assert.strictEqual(statusCode, 403);
  assert.ok(jsonResponse.error);
});
