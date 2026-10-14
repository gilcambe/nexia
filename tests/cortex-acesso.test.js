import test from 'node:test';
import assert from 'node:assert';
import { isCortexPermitido } from '../netlify/functions/middleware.js';

// Helper para limpar/definir variáveis de ambiente entre testes
function setEnv(vars) {
  process.env = { ...process.env, ...vars };
}

test('master verificado tem acesso', async t => {
  setEnv({ CORTEX_MASTER_EMAIL: 'master@example.com', CORTEX_EMAILS_PERMITIDOS: '' });
  assert.strictEqual(isCortexPermitido('master@example.com'), true);
});
