'use strict';
// Execution.request_text guarda o pedido inteiro (pode ter código com "token =" ou Bearer), mas chaves reais seguem barradas.
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { SCHEMAS, ENTITY_NAMES, idPattern } = require('../../nexia-ai/vault/schemas');
const { validateEntity } = require('../../nexia-ai/vault/validate');
const { valid } = require('../vault-fixtures');

const ids = Object.fromEntries(ENTITY_NAMES.map(e => [e, `${SCHEMAS[e].idPrefix}_${crypto.randomBytes(16).toString('hex')}`]));
const v = (data) => validateEntity(SCHEMAS.Execution, data, { refPattern: idPattern });

const com = texto => v({ ...valid.Execution(ids), request_text: texto });

test('request_text aceita código com token/Bearer', () => {
  const r = com('const token = await getToken();\nheaders: { Authorization: `Bearer ${token}` }');
  assert.deepStrictEqual(r.secrets, []);
});

test('request_text continua barrando chave real', () => {
  const r = com('use ghp_' + 'a'.repeat(30));
  assert.ok(r.secrets.length > 0);
});

test('request_summary continua com a checagem completa', () => {
  const r = v({ ...valid.Execution(ids), request_summary: ['tok', 'en'].join('') + ' = ' + 'abc'.repeat(4) });
  assert.ok(r.secrets.length > 0);
});
