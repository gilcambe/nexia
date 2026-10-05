'use strict';
// Vault: schemas, detecção de secrets, contexto de execução e índices (sem Firestore).
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { SCHEMAS, ENTITY_NAMES, idPattern } = require('../../nexia-ai/vault/schemas');
const { validateEntity } = require('../../nexia-ai/vault/validate');
const { detectSecret, redactSecrets } = require('../../nexia-ai/vault/secrets');
const { createExecutionContext } = require('../../nexia-ai/vault/execution');
const { mergedIndexFile, INDEX_FILE } = require('../../nexia-ai/vault/indexes');
const { valid, invalid, expectedInvalidRule, fakeSecrets } = require('../vault-fixtures');

const ids = Object.fromEntries(ENTITY_NAMES.map(e => [e, `${SCHEMAS[e].idPrefix}_${crypto.randomBytes(16).toString('hex')}`]));
const v = (entity, data, opts = {}) => validateEntity(SCHEMAS[entity], data, { refPattern: idPattern, ...opts });

test('19 entidades (16 da Fase 2 + ToolCall e ToolPolicy da Fase 6 + Execution da Fase 10), todas com coleção vault_*, prefixo de id e schemaVersion', () => {
  assert.deepStrictEqual(ENTITY_NAMES, ['Client', 'Project', 'Repository', 'Environment', 'Requirement', 'Decision',
    'Task', 'Artifact', 'Conversation', 'Memory', 'Change', 'TestRun', 'Deployment', 'Error', 'Integration', 'ProjectSnapshot',
    'ToolCall', 'ToolPolicy', 'Execution']);
  const prefixes = new Set();
  for (const e of ENTITY_NAMES) {
    assert.match(SCHEMAS[e].collection, /^vault_[a-z_]+$/);
    assert.strictEqual(SCHEMAS[e].schemaVersion, 1);
    assert.ok(!prefixes.has(SCHEMAS[e].idPrefix)); prefixes.add(SCHEMAS[e].idPrefix);
    if (!['Client', 'Project', 'Memory'].includes(e)) assert.ok(SCHEMAS[e].fields.project_id?.required, `${e}.project_id obrigatório`);
  }
  assert.ok(SCHEMAS.Project.fields.client_id.required);
});

for (const e of ENTITY_NAMES) {
  test(`schema ${e}: válido passa, inválido é rejeitado com a regra esperada`, () => {
    const ok = v(e, valid[e](ids));
    assert.deepStrictEqual(ok.issues, []);
    assert.deepStrictEqual(ok.secrets, []);
    const bad = v(e, invalid[e](ids));
    assert.ok(bad.issues.some(i => i.rule === expectedInvalidRule[e]), `${e}: ${JSON.stringify(bad.issues)}`);
  });
}

test('campos desconhecidos e metadados do servidor são rejeitados', () => {
  for (const f of ['id', 'tenant_id', 'schemaVersion', 'version', 'created_at', 'deleted_at', 'last_execution_id', 'foo']) {
    const r = v('Client', { ...valid.Client(ids), [f]: 'x' });
    assert.deepStrictEqual(r.issues.find(i => i.path === f), { path: f, rule: 'unknownField' }, f);
  }
});

test('nenhuma entidade declara campo com nome de metadado do servidor (Fase 9: Deployment.version → release)', () => {
  const { META_FIELDS } = require('../../nexia-ai/vault/repository');
  for (const [name, schema] of Object.entries(SCHEMAS)) {
    for (const f of Object.keys(schema.fields)) assert.ok(!META_FIELDS.includes(f), `${name}.${f}`);
  }
});

test('tipos: string vazia, número em texto, data inválida, array duplicado', () => {
  assert.ok(v('Client', { ...valid.Client(ids), name: '   ' }).issues.some(i => i.rule === 'minLength'));
  assert.ok(v('Client', { ...valid.Client(ids), name: 42 }).issues.some(i => i.rule === 'type:string'));
  assert.ok(v('Decision', { ...valid.Decision(ids), decided_at: '02/10/2026' }).issues.some(i => i.rule === 'type:timestamp'));
  assert.ok(v('Project', { ...valid.Project(ids), stack: ['node', 'node'] }).issues.some(i => i.rule === 'uniqueItems'));
  assert.ok(v('Memory', { layer: 'fact', content: 'x', status: 'pending' }).issues.some(i => i.rule === 'atLeastOne'));
});

test('Environment: secret_refs aceita nomes de variável e rejeita valores de secret', () => {
  const env = valid.Environment(ids);
  assert.deepStrictEqual(v('Environment', env).secrets, []);
  // nome fora do padrão de variável de ambiente
  const badName = v('Environment', { ...env, secret_refs: [{ name: 'groq key', store: 'render' }] });
  assert.ok(badName.issues.some(i => i.path === 'secret_refs[0].name' && i.rule === 'pattern:env_var_name'));
  // campo "value" não existe no schema
  const withValue = v('Environment', { ...env, secret_refs: [{ name: 'GROQ_API_KEY', store: 'render', value: 'x' }] });
  assert.ok(withValue.issues.some(i => i.path === 'secret_refs[0].value' && i.rule === 'unknownField'));
  for (const [detector, secret] of Object.entries(fakeSecrets())) {
    for (const [path, data] of [
      ['notes', { ...env, notes: `deploy: ${secret}` }],
      ['secret_refs[0].description', { ...env, secret_refs: [{ name: 'GROQ_API_KEY', store: 'render', description: secret }] }],
      ['urls[0]', { ...env, urls: [`https://nexia-os.onrender.com/?k=${secret}`] }],
    ]) {
      const r = v('Environment', data);
      const hit = r.secrets.find(s => s.path === path);
      assert.ok(hit, `${detector} em ${path} não detectado`);
      assert.ok(!JSON.stringify([r.secrets, r.issues]).includes(secret), 'o diagnóstico não pode conter o valor');
    }
  }
});

test('detectSecret: não acusa nomes de variável, URLs, ids e texto comum', () => {
  for (const s of ['GROQ_API_KEY', 'FIREBASE_SERVICE_ACCOUNT_BASE64', 'https://nexia-os.onrender.com',
    `prj_${crypto.randomBytes(16).toString('hex')}`, 'Vault em coleções vault_* no Firestore nexia-c8710',
    'tokenização de texto', 'password reset flow']) {
    assert.deepStrictEqual(detectSecret(s), [], s);
  }
});

test('redactSecrets: troca só o trecho suspeito e o resultado passa no detector', () => {
  const t = `Commit ${'ab12'.repeat(10)}, ${['tok', 'en'].join('')}: ${'seg'.repeat(3)}, chave ${'AIza' + 'x'.repeat(35)} e o texto comum fica.`;
  const r = redactSecrets(t);
  assert.deepStrictEqual(detectSecret(r), []);
  assert.match(r, /o texto comum fica\./);
  assert.strictEqual(redactSecrets('nada aqui'), 'nada aqui');
});

test('contexto de execução: Execution ID gerado, formato validado', () => {
  const a = createExecutionContext({ tenantId: 'nexia', actor: { type: 'user', id: 'gilcambe' } });
  const b = createExecutionContext({ tenantId: 'nexia', actor: { type: 'user', id: 'gilcambe' } });
  assert.match(a.executionId, /^exec_[0-9a-f]{32}$/);
  assert.notStrictEqual(a.executionId, b.executionId);
  assert.ok(Object.isFrozen(a));
  assert.strictEqual(createExecutionContext({ tenantId: 'nexia', actor: a.actor, executionId: a.executionId }).executionId, a.executionId);
  for (const bad of [{ tenantId: '../x', actor: a.actor }, { tenantId: 'nexia', actor: { type: 'root', id: 'x' } },
    { tenantId: 'nexia', actor: a.actor, executionId: 'abc' }]) {
    assert.throws(() => createExecutionContext(bad), { code: 'CONTEXT' });
  }
});

test('firestore.indexes.json contém exatamente os índices vault_* gerados dos schemas', () => {
  const current = JSON.parse(require('fs').readFileSync(INDEX_FILE, 'utf8'));
  assert.deepStrictEqual(current, mergedIndexFile(), 'rode: node nexia-ai/vault/indexes.js --write');
});

test('VAULT-SCHEMAS.md está em dia com schemas.js', () => {
  const { render, DOC_FILE } = require('../../nexia-ai/vault/schema-doc');
  assert.strictEqual(require('fs').readFileSync(DOC_FILE, 'utf8'), render(), 'rode: node nexia-ai/vault/schema-doc.js --write');
});
