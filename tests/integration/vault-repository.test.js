'use strict';
// Vault (Fase 2): camada de acesso contra o Firestore Emulator.
// Rodar com: npm run test:rules
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { createVault, createExecutionContext, SCHEMAS, ENTITY_NAMES, CODES } = require('../../nexia-ai/vault');
const { AUDIT_COLLECTION, IDEMPOTENCY_COLLECTION } = require('../../nexia-ai/vault/repository');
const { valid, invalid, expectedInvalidRule, ORDER, fakeSecrets } = require('../vault-fixtures');

let db, vault;
const RUN = crypto.randomBytes(4).toString('hex');
const T1 = `vault-a-${RUN}`;
const T2 = `vault-b-${RUN}`;
const T3 = `vault-c-${RUN}`;
const owner = { type: 'user', id: 'gilcambe' };
const ctxFor = (tenantId, actor = owner) => createExecutionContext({ tenantId, actor });

const rejects = (p, code, check) => assert.rejects(p, err => {
  assert.strictEqual(err.name, 'VaultError', err.stack);
  assert.strictEqual(err.code, code, `esperado ${code}, veio ${err.code}: ${err.message} ${JSON.stringify(err.details)}`);
  if (check) check(err);
  return true;
});

const countTenant = async (collection, tenantId) => (await db.collection(collection).where('tenant_id', '==', tenantId).count().get()).data().count;
const auditOf = async id => (await db.collection(AUDIT_COLLECTION).where('entity_id', '==', id).get()).docs.map(d => d.data());

/** Cria o grafo completo do projeto NEXIA (16 entidades) num tenant. */
async function seed(tenantId) {
  const ctx = ctxFor(tenantId);
  const ids = {}; const records = {};
  for (const e of ORDER) {
    const { record } = await vault[e].create(ctx, valid[e](ids));
    ids[e] = record.id; records[e] = record;
  }
  return { ctx, ids, records };
}

let main; // grafo principal em T1

test.before(async () => {
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST, 'rode via `npm run test:rules` (emuladores)');
  ({ db } = require('../../netlify/functions/firebase-init'));
  assert.ok(db, 'firebase-init deveria conectar ao emulador');
  vault = createVault({ db });
  for (const t of [T1, T2, T3]) await db.doc(`tenants/${t}`).set({ slug: t, name: t, plan: 'free' });
  main = await seed(T1);
});

test('1. cria as 16 entidades com metadados do servidor, ids estáveis e Execution ID', async () => {
  const { ctx, records } = main;
  assert.strictEqual(Object.keys(records).length, 16);
  for (const e of ENTITY_NAMES) {
    const r = records[e];
    assert.match(r.id, new RegExp(`^${SCHEMAS[e].idPrefix}_[0-9a-f]{32}$`), e);
    assert.strictEqual(r.tenant_id, T1);
    assert.strictEqual(r.schemaVersion, 1);
    assert.strictEqual(r.version, 1);
    assert.strictEqual(r.deleted_at, null);
    assert.deepStrictEqual(r.created_by, owner);
    assert.strictEqual(r.last_execution_id, ctx.executionId);
    assert.match(r.created_at, /^\d{4}-\d{2}-\d{2}T/);
    // timestamp é do servidor (Timestamp do Firestore), id do documento == campo id
    const raw = await db.collection(SCHEMAS[e].collection).doc(r.id).get();
    assert.strictEqual(raw.id, r.id);
    assert.strictEqual(raw.get('created_at').constructor.name, 'Timestamp');
    assert.ok(Math.abs(raw.get('created_at').toMillis() - Date.now()) < 120000);
  }
  assert.strictEqual(records.Project.autonomy_level, 0, 'default do nível de autonomia');
  assert.strictEqual(records.Decision.decided_at, '2026-10-02T00:00:00.000Z');
});

for (const e of ENTITY_NAMES) {
  test(`2. schema ${e}: inválido é rejeitado no repositório e nada é gravado`, async () => {
    const before = await countTenant(SCHEMAS[e].collection, T1);
    await rejects(vault[e].create(main.ctx, invalid[e](main.ids)), CODES.VALIDATION,
      err => assert.ok(err.details.issues.some(i => i.rule === expectedInvalidRule[e]), JSON.stringify(err.details)));
    assert.strictEqual(await countTenant(SCHEMAS[e].collection, T1), before);
  });
}

test('3. metadados do servidor não podem vir na entrada', async () => {
  for (const f of ['id', 'tenant_id', 'version', 'schemaVersion', 'created_at', 'deleted_at', 'last_execution_id']) {
    await rejects(vault.Requirement.create(main.ctx, { ...valid.Requirement(main.ids), [f]: 'x' }), CODES.VALIDATION,
      err => assert.deepStrictEqual(err.details.issues, [{ path: f, rule: 'unknownField' }]));
  }
});

test('4. contexto: sem contexto válido ou tenant inexistente, nada é gravado', async () => {
  await rejects(vault.Client.create({ tenantId: T1 }, valid.Client({})), CODES.CONTEXT);
  await rejects(vault.Client.create(ctxFor(`vault-x-${RUN}`), valid.Client({})), CODES.TENANT_NOT_FOUND);
});

test('5. integridade referencial: inexistente, outro tenant, outro projeto, outro cliente, excluído, auto-referência', async () => {
  const { ctx, ids } = main;
  const ghost = `prj_${crypto.randomBytes(16).toString('hex')}`;
  await rejects(vault.Requirement.create(ctx, { ...valid.Requirement(ids), project_id: ghost }), CODES.REFERENCE,
    err => assert.deepStrictEqual(err.details.issues, [{ path: 'project_id', rule: 'not_found' }]));

  const other = await seed(T2);
  await rejects(vault.Requirement.create(ctx, { ...valid.Requirement(ids), project_id: other.ids.Project }), CODES.REFERENCE,
    err => assert.deepStrictEqual(err.details.issues, [{ path: 'project_id', rule: 'not_found' }]));

  // segundo projeto do mesmo cliente: requisito do projeto 1 não pode ser usado por tarefa do projeto 2
  const { record: p2 } = await vault.Project.create(ctx, { ...valid.Project(ids), slug: 'nexia-site', name: 'NEXIA site', type: 'website' });
  await rejects(vault.Task.create(ctx, { ...valid.Task(ids), project_id: p2.id }), CODES.REFERENCE,
    err => assert.deepStrictEqual(err.details.issues, [{ path: 'requirement_id', rule: 'other_project' }]));
  // repositório principal precisa ser do próprio projeto
  await rejects(vault.Project.update(ctx, p2.id, { primary_repository_id: ids.Repository }, { expectedVersion: 1 }), CODES.REFERENCE,
    err => assert.deepStrictEqual(err.details.issues, [{ path: 'primary_repository_id', rule: 'other_project' }]));
  const proj = await vault.Project.update(ctx, ids.Project, { primary_repository_id: ids.Repository }, { expectedVersion: 1 });
  assert.strictEqual(proj.primary_repository_id, ids.Repository);
  assert.strictEqual(proj.version, 2);

  // Memory: projeto precisa ser do cliente informado
  const { record: c2 } = await vault.Client.create(ctx, { name: 'Bezsan', slug: 'bezsan', status: 'prospect' });
  await rejects(vault.Memory.create(ctx, { ...valid.Memory(ids), client_id: c2.id }), CODES.REFERENCE,
    err => assert.deepStrictEqual(err.details.issues, [{ path: 'project_id', rule: 'other_client' }]));

  // referência a registro excluído
  const { record: req2 } = await vault.Requirement.create(ctx, { ...valid.Requirement(ids), title: 'Requisito temporário' });
  await vault.Requirement.softDelete(ctx, req2.id, { expectedVersion: 1 });
  await rejects(vault.Task.create(ctx, { ...valid.Task(ids), requirement_id: req2.id }), CODES.REFERENCE,
    err => assert.deepStrictEqual(err.details.issues, [{ path: 'requirement_id', rule: 'deleted' }]));

  // auto-referência
  await rejects(vault.Task.update(ctx, ids.Task, { depends_on: [ids.Task] }, { expectedVersion: 1 }), CODES.REFERENCE,
    err => assert.deepStrictEqual(err.details.issues, [{ path: 'depends_on[0]', rule: 'self_reference' }]));
});

test('6. unicidade por tenant: slug, repositório e ambiente', async () => {
  const { ctx, ids } = main;
  await rejects(vault.Client.create(ctx, valid.Client(ids)), CODES.UNIQUE, err => assert.deepStrictEqual(err.details.fields, ['slug']));
  await rejects(vault.Repository.create(ctx, valid.Repository(ids)), CODES.UNIQUE);
  await rejects(vault.Environment.create(ctx, valid.Environment(ids)), CODES.UNIQUE);
  // outro nome de ambiente no mesmo projeto é permitido
  const { record } = await vault.Environment.create(ctx, { project_id: ids.Project, name: 'development', provider: 'local', urls: ['http://localhost:3001'] });
  assert.strictEqual(record.name, 'development');
});

test('7. campos imutáveis não mudam no update', async () => {
  const { ctx, ids } = main;
  const p = await vault.Project.get(ctx, ids.Project);
  await rejects(vault.Project.update(ctx, ids.Project, { slug: 'outro' }, { expectedVersion: p.version }), CODES.VALIDATION,
    err => assert.deepStrictEqual(err.details.issues, [{ path: 'slug', rule: 'immutable' }]));
  // mesmo valor é aceito (no-op do campo)
  const same = await vault.Project.update(ctx, ids.Project, { slug: 'nexia-os', status: 'active' }, { expectedVersion: p.version });
  assert.strictEqual(same.version, p.version + 1);
});

test('8. concorrência: expectedVersion obrigatório, conflito detectado, uma vencedora em escrita simultânea', async () => {
  const { ctx, ids } = main;
  const { record: r } = await vault.Requirement.create(ctx, { ...valid.Requirement(ids), title: 'Concorrência' });
  await rejects(vault.Requirement.update(ctx, r.id, { status: 'approved' }), CODES.VALIDATION);
  const r2 = await vault.Requirement.update(ctx, r.id, { status: 'approved' }, { expectedVersion: 1 });
  assert.strictEqual(r2.version, 2);
  await rejects(vault.Requirement.update(ctx, r.id, { status: 'done' }, { expectedVersion: 1 }), CODES.VERSION_CONFLICT,
    err => assert.deepStrictEqual(err.details, { expectedVersion: 1, currentVersion: 2 }));

  const results = await Promise.allSettled([
    vault.Requirement.update(ctx, r.id, { priority: 'critical' }, { expectedVersion: 2 }),
    vault.Requirement.update(ctx, r.id, { priority: 'low' }, { expectedVersion: 2 }),
  ]);
  const ok = results.filter(x => x.status === 'fulfilled');
  const ko = results.filter(x => x.status === 'rejected');
  assert.strictEqual(ok.length, 1, JSON.stringify(results.map(x => x.status)));
  assert.strictEqual(ko[0].reason.code, CODES.VERSION_CONFLICT);
  const final = await vault.Requirement.get(ctx, r.id);
  assert.strictEqual(final.version, 3);
  assert.strictEqual(final.priority, ok[0].value.priority);
});

test('9. idempotência: repetição devolve o mesmo registro; conteúdo diferente é conflito; simultâneas geram um só', async () => {
  const { ctx, ids } = main;
  const key = `ci-run-${RUN}-unit`;
  const data = { ...valid.TestRun(ids), suite: 'npm test (idempotência)' };
  const first = await vault.TestRun.create(ctx, data, { idempotencyKey: key });
  const again = await vault.TestRun.create(ctxFor(T1), data, { idempotencyKey: key });
  assert.strictEqual(first.replayed, false);
  assert.strictEqual(again.replayed, true);
  assert.strictEqual(again.record.id, first.record.id);
  const dupes = await db.collection(SCHEMAS.TestRun.collection).where('tenant_id', '==', T1).where('suite', '==', 'npm test (idempotência)').get();
  assert.strictEqual(dupes.size, 1);
  assert.strictEqual((await auditOf(first.record.id)).length, 1, 'repetição não gera auditoria');
  await rejects(vault.TestRun.create(ctx, { ...data, status: 'failed' }, { idempotencyKey: key }), CODES.IDEMPOTENCY_CONFLICT);
  // a chave é por tenant e entidade
  const other = await seed(T3);
  const t2 = await vault.TestRun.create(other.ctx, { ...data, project_id: other.ids.Project, change_id: other.ids.Change }, { idempotencyKey: key });
  assert.strictEqual(t2.replayed, false);

  const k2 = `ci-run-${RUN}-par`;
  const par = await Promise.all([1, 2, 3].map(() =>
    vault.Error.create(ctx, { ...valid.Error(ids), message: 'Evento simultâneo de teste' }, { idempotencyKey: k2 })));
  assert.strictEqual(new Set(par.map(p => p.record.id)).size, 1);
  assert.strictEqual(par.filter(p => !p.replayed).length, 1);
  const stored = await db.collection(IDEMPOTENCY_COLLECTION).where('tenant_id', '==', T1).where('entity_id', '==', par[0].record.id).get();
  assert.strictEqual(stored.size, 1);
  assert.ok(!JSON.stringify(stored.docs[0].data()).includes(k2), 'a chave é guardada só como hash');
  await rejects(vault.Error.create(ctx, valid.Error(ids), { idempotencyKey: 'curta' }), CODES.VALIDATION);
});

test('10. soft-delete: bloqueado por dependentes, oculto de get/list, restaurável, imutável enquanto excluído', async () => {
  const { ctx, ids } = main;
  await rejects(vault.Project.softDelete(ctx, ids.Project, { expectedVersion: (await vault.Project.get(ctx, ids.Project)).version }),
    CODES.HAS_DEPENDENTS, err => {
      const names = err.details.dependents.map(d => `${d.entity}.${d.field}`);
      assert.ok(names.includes('Repository.project_id') && names.includes('Memory.project_id'), names.join());
    });
  // dependente via array (ProjectSnapshot.environment_ids)
  await rejects(vault.Environment.softDelete(ctx, ids.Environment, { expectedVersion: 1 }), CODES.HAS_DEPENDENTS,
    err => assert.ok(err.details.dependents.some(d => d.entity === 'ProjectSnapshot' && d.field === 'environment_ids')));

  const { record: art } = await vault.Artifact.create(ctx, { ...valid.Artifact(ids), title: 'Documento para exclusão', uri: 'PHASE-1-REPORT.md' });
  const del = await vault.Artifact.softDelete(ctx, art.id, { expectedVersion: 1 });
  assert.match(del.deleted_at, /^\d{4}-/);
  assert.strictEqual(del.version, 2);
  assert.ok((await db.collection(SCHEMAS.Artifact.collection).doc(art.id).get()).exists, 'documento continua no banco');
  await rejects(vault.Artifact.get(ctx, art.id), CODES.NOT_FOUND);
  assert.ok(!(await vault.Artifact.list(ctx, { where: { project_id: ids.Project } })).some(a => a.id === art.id));
  await rejects(vault.Artifact.update(ctx, art.id, { title: 'x' }, { expectedVersion: 2 }), CODES.DELETED);
  await rejects(vault.Artifact.softDelete(ctx, art.id, { expectedVersion: 2 }), CODES.DELETED);
  const back = await vault.Artifact.restore(ctx, art.id, { expectedVersion: 2 });
  assert.strictEqual(back.deleted_at, null);
  assert.strictEqual(back.version, 3);
  await rejects(vault.Artifact.restore(ctx, art.id, { expectedVersion: 3 }), CODES.VALIDATION);

  // restore exige que as referências continuem válidas
  const { record: c } = await vault.Client.create(ctx, { name: 'Viajante Pro', slug: 'viajante-pro', status: 'prospect' });
  const { record: m } = await vault.Memory.create(ctx, { client_id: c.id, layer: 'fact', content: 'Cliente em prospecção.', status: 'pending' });
  await vault.Memory.softDelete(ctx, m.id, { expectedVersion: 1 });
  await vault.Client.softDelete(ctx, c.id, { expectedVersion: 1 });
  await rejects(vault.Memory.restore(ctx, m.id, { expectedVersion: 2 }), CODES.REFERENCE,
    err => assert.deepStrictEqual(err.details.issues, [{ path: 'client_id', rule: 'deleted' }]));
  // slug continua reservado após soft-delete (não reaproveita identidade)
  await rejects(vault.Client.create(ctx, { name: 'Viajante Pro', slug: 'viajante-pro', status: 'active' }), CODES.UNIQUE);
});

test('11. auditoria: uma entrada por escrita, com Execution ID, ator, operação, versão e hash, sem valores', async () => {
  const ctx = ctxFor(T1, { type: 'agent', id: 'claude-code' });
  const { ids } = main;
  const notes = 'Ambiente de homologação ainda não existe no Render.';
  const { record } = await vault.Environment.create(ctx, { project_id: ids.Project, name: 'staging', provider: 'render', notes,
    secret_refs: [{ name: 'GROQ_API_KEY', store: 'render' }] });
  const u = await vault.Environment.update(ctx, record.id, { notes: null, branch: 'develop' }, { expectedVersion: 1 });
  assert.ok(!('notes' in u), 'null remove o campo opcional');
  await vault.Environment.softDelete(ctx, record.id, { expectedVersion: 2 });
  await vault.Environment.restore(ctx, record.id, { expectedVersion: 3 });

  const hist = await vault.Environment.history(main.ctx, record.id);
  assert.deepStrictEqual(hist.map(h => [h.operation, h.version]), [['create', 1], ['update', 2], ['soft_delete', 3], ['restore', 4]]);
  for (const h of hist) {
    assert.deepStrictEqual(Object.keys(h).sort(), ['actor', 'at', 'changed_fields', 'content_hash', 'entity', 'entity_id',
      'entity_schema_version', 'execution_id', 'operation', 'schemaVersion', 'tenant_id', 'version']);
    assert.strictEqual(h.execution_id, ctx.executionId);
    assert.deepStrictEqual(h.actor, { type: 'agent', id: 'claude-code' });
    assert.strictEqual(h.entity, 'Environment');
    assert.match(h.content_hash, /^[0-9a-f]{64}$/);
    const raw = JSON.stringify(h);
    for (const value of [notes, 'GROQ_API_KEY', 'develop', 'render']) assert.ok(!raw.includes(value), `auditoria contém valor: ${value}`);
  }
  assert.deepStrictEqual(hist[1].changed_fields, ['branch', 'notes']);
  assert.notStrictEqual(hist[0].content_hash, hist[1].content_hash);
  const doc = await vault.Environment.get(main.ctx, record.id);
  assert.strictEqual(doc.last_execution_id, ctx.executionId);
  assert.deepStrictEqual(doc.updated_by, { type: 'agent', id: 'claude-code' });
  assert.deepStrictEqual(doc.created_by, { type: 'agent', id: 'claude-code' });
});

test('12. Environment rejeita valores de secret (create e update) sem gravar nem ecoar o valor', async () => {
  const { ctx, ids } = main;
  const envCount = await countTenant(SCHEMAS.Environment.collection, T1);
  const auditCount = await countTenant(AUDIT_COLLECTION, T1);
  const secrets = fakeSecrets();
  for (const [detector, secret] of Object.entries(secrets)) {
    await rejects(vault.Environment.create(ctx, { project_id: ids.Project, name: 'preview', provider: 'render',
      secret_refs: [{ name: 'GROQ_API_KEY', store: 'render', description: secret }] }), CODES.SECRET_DETECTED, err => {
      assert.strictEqual(err.details.secrets[0].path, 'secret_refs[0].description');
      assert.ok(!JSON.stringify({ m: err.message, d: err.details }).includes(secret), `${detector}: erro ecoa o valor`);
    });
  }
  await rejects(vault.Environment.create(ctx, { project_id: ids.Project, name: 'preview', provider: 'render',
    secret_refs: [{ name: 'GROQ_API_KEY', store: 'render', value: secrets.groq_key }] }), CODES.VALIDATION);
  const env = await vault.Environment.get(ctx, ids.Environment);
  await rejects(vault.Environment.update(ctx, ids.Environment, { notes: `chave: ${secrets.private_key_pem}` }, { expectedVersion: env.version }),
    CODES.SECRET_DETECTED, err => assert.deepStrictEqual(err.details.secrets.map(s => s.path), ['notes']));
  // o mesmo vale para as demais entidades
  await rejects(vault.Decision.create(ctx, { ...valid.Decision(ids), rationale: `token ${secrets.github_token}` }), CODES.SECRET_DETECTED);
  assert.strictEqual(await countTenant(SCHEMAS.Environment.collection, T1), envCount);
  assert.strictEqual(await countTenant(AUDIT_COLLECTION, T1), auditCount);
  assert.strictEqual((await vault.Environment.get(ctx, ids.Environment)).version, env.version);
});

test('13. isolamento entre tenants na camada de acesso', async () => {
  const { ids } = main;
  const t2 = ctxFor(T2);
  await rejects(vault.Project.get(t2, ids.Project), CODES.NOT_FOUND);
  await rejects(vault.Project.update(t2, ids.Project, { status: 'paused' }, { expectedVersion: 1 }), CODES.NOT_FOUND);
  await rejects(vault.Artifact.softDelete(t2, ids.Artifact, { expectedVersion: 1 }), CODES.NOT_FOUND);
  assert.ok(!(await vault.Project.list(t2)).some(p => p.id === ids.Project));
  assert.ok((await vault.Project.list(main.ctx)).some(p => p.id === ids.Project));
});

test('14. listagem por project_id, client_id e status; filtros não suportados são rejeitados', async () => {
  const { ctx, ids } = main;
  const tasks = await vault.Task.list(ctx, { where: { project_id: ids.Project } });
  assert.ok(tasks.length >= 1 && tasks.every(t => t.project_id === ids.Project));
  const projects = await vault.Project.list(ctx, { where: { client_id: ids.Client } });
  assert.ok(projects.length >= 2 && projects.every(p => p.client_id === ids.Client));
  const active = await vault.Project.list(ctx, { where: { status: 'active' } });
  assert.ok(active.every(p => p.status === 'active'));
  for (let i = 1; i < projects.length; i++) assert.ok(projects[i - 1].updated_at >= projects[i].updated_at, 'ordenado por updated_at desc');
  await rejects(vault.Task.list(ctx, { where: { title: 'x' } }), CODES.VALIDATION);
  await rejects(vault.Task.list(ctx, { where: { project_id: ids.Project, status: 'todo' } }), CODES.VALIDATION);
  await rejects(vault.Task.list(ctx, { where: { status: 'qualquer' } }), CODES.VALIDATION);
  await rejects(vault.Task.list(ctx, { limit: 1000 }), CODES.VALIDATION);
});

test('15. schemaVersion desconhecido falha fechado na leitura e na escrita', async () => {
  const { ctx, ids } = main;
  const { record } = await vault.Requirement.create(ctx, { ...valid.Requirement(ids), title: 'Versão futura' });
  await db.collection(SCHEMAS.Requirement.collection).doc(record.id).update({ schemaVersion: 2 });
  await rejects(vault.Requirement.get(ctx, record.id), CODES.SCHEMA_VERSION);
  await rejects(vault.Requirement.update(ctx, record.id, { status: 'done' }, { expectedVersion: 1 }), CODES.SCHEMA_VERSION);
});
