const test = require('node:test');
const assert = require('node:assert/strict');
const validateEmail = require('../../lib/email');

test('validateEmail - caso comum com espaços e letras maiúsculas', () => {
  const result = validateEmail('  John.Doe@example.COM  ');
  assert.strictEqual(result, 'john.doe@example.com');
});

test('validateEmail - caso de borda com subdomínio e sinal +, sem espaços', () => {
  const result = validateEmail('user+tag@Sub.Domain.Co.UK');
  assert.strictEqual(result, 'user+tag@sub.domain.co.uk');
});

test('validateEmail - entrada inválida (ausência de @)', () => {
  const result = validateEmail('invalid-email.com');
  assert.strictEqual(result, null);
});