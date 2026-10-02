'use strict';
// Camada única de acesso ao Vault (spec §25, §26, §16).
//
// Toda leitura e escrita do Vault passa por aqui. Garantias:
//  - IDs estáveis gerados pelo servidor ({prefixo}_{32 hex}); id do documento == campo id
//  - timestamps do servidor (created_at, updated_at, deleted_at)
//  - soft-delete (deleted_at) com bloqueio quando há dependentes ativos; restore
//  - integridade referencial verificada dentro da transação de escrita
//  - unicidade por tenant (coleção vault_unique)
//  - idempotency key na criação (coleção vault_idempotency)
//  - controle de concorrência otimista: version (também usado como etag)
//  - Execution ID propagado para o documento e para a auditoria
//  - auditoria na MESMA transação: execution_id, ator, operação, versão e hash,
//    sem valores de campo (coleção vault_audit)
//  - isolamento por tenant: todo documento carrega tenant_id e só é visível ao
//    contexto do mesmo tenant
const crypto = require('crypto');
const { SCHEMAS, ENTITY_NAMES, idPattern } = require('./schemas');
const { validateEntity, canonical } = require('./validate');
const { VaultError, CODES } = require('./errors');
const { assertContext } = require('./execution');

const AUDIT_COLLECTION = 'vault_audit';
const IDEMPOTENCY_COLLECTION = 'vault_idempotency';
const UNIQUE_COLLECTION = 'vault_unique';
const AUDIT_SCHEMA_VERSION = 1;
const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9_.:-]{8,128}$/;
const LIST_FILTERS = ['client_id', 'project_id', 'status'];
const LIST_MAX = 200;

const META_FIELDS = ['id', 'tenant_id', 'schemaVersion', 'version', 'created_at', 'updated_at', 'deleted_at',
  'created_by', 'updated_by', 'last_execution_id'];

const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');
const newId = prefix => `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;

/** Mapa entidade → [{ entity, field, array }] de quem referencia essa entidade. */
function buildDependents() {
  const map = Object.fromEntries(ENTITY_NAMES.map(e => [e, []]));
  for (const [entity, s] of Object.entries(SCHEMAS)) {
    for (const [field, def] of Object.entries(s.fields)) {
      if (def.kind === 'ref') map[def.entity].push({ entity, field, array: false });
      else if (def.kind === 'array' && def.of.kind === 'ref') map[def.of.entity].push({ entity, field, array: true });
    }
  }
  return map;
}
const DEPENDENTS = buildDependents();

const stripNulls = obj => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null && v !== undefined));

/** Converte Timestamps do Firestore em ISO 8601 (recursivo). */
function toPlain(v) {
  if (v === null || v === undefined) return v ?? null;
  if (typeof v.toDate === 'function') return v.toDate().toISOString();
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.map(toPlain);
  if (typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toPlain(x)]));
  return v;
}

function domainOf(schema, doc) {
  const out = {};
  for (const k of Object.keys(schema.fields)) if (doc[k] !== undefined) out[k] = doc[k];
  return out;
}

function throwIfInvalid(entity, result) {
  if (result.secrets.length) {
    throw new VaultError(CODES.SECRET_DETECTED,
      `${entity}: campo parece conter um secret. Guarde apenas a referência (nome da variável e secret store).`,
      { secrets: result.secrets });
  }
  if (result.issues.length) throw new VaultError(CODES.VALIDATION, `${entity}: dados inválidos.`, { issues: result.issues });
}

/**
 * Cria a camada de acesso.
 * @param {{ db: FirebaseFirestore.Firestore, FieldValue?: any }} deps  db do Admin SDK
 */
function createVault({ db, FieldValue } = {}) {
  if (!db || typeof db.runTransaction !== 'function') {
    throw new VaultError(CODES.UNAVAILABLE, 'Firestore (Admin SDK) indisponível para o Vault.');
  }
  const FV = FieldValue || require('firebase-admin/firestore').FieldValue;

  function checkSchemaVersion(entity, data) {
    if (data.schemaVersion !== SCHEMAS[entity].schemaVersion) {
      // Sem migração registrada para outras versões: falha fechada em vez de interpretar errado.
      throw new VaultError(CODES.SCHEMA_VERSION, `${entity}: schemaVersion do documento não suportado por este código.`,
        { expected: SCHEMAS[entity].schemaVersion, found: Number.isInteger(data.schemaVersion) ? data.schemaVersion : null });
    }
  }

  function toRecord(entity, snap) {
    const data = snap.data();
    checkSchemaVersion(entity, data);
    return toPlain(data);
  }

  async function assertTenant(tx, tenantId) {
    const t = await tx.get(db.collection('tenants').doc(tenantId));
    if (!t.exists) throw new VaultError(CODES.TENANT_NOT_FOUND, 'Tenant do contexto não existe.');
  }

  /**
   * Integridade referencial (dentro da transação):
   *  - o registro referenciado existe, é do mesmo tenant e não está soft-deleted
   *  - se o referenciado pertence a um projeto, é o MESMO projeto do registro
   *  - se o registro tem client_id e project_id, o projeto é desse cliente
   */
  async function checkRefs(tx, ctx, entity, id, value, refs) {
    const unique = new Map();
    for (const r of refs) unique.set(`${r.entity}/${r.id}`, r);
    const paths = [...unique.values()];
    const snaps = await Promise.all(paths.map(r => tx.get(db.collection(SCHEMAS[r.entity].collection).doc(r.id))));
    const ownProject = entity === 'Project' ? id : value.project_id;
    const issues = [];
    const byKey = new Map();
    paths.forEach((r, i) => {
      const s = snaps[i];
      const d = s.exists ? s.data() : null;
      byKey.set(`${r.entity}/${r.id}`, d);
      if (r.entity === entity && r.id === id) { issues.push({ path: r.path, rule: 'self_reference' }); return; }
      if (!d || d.tenant_id !== ctx.tenantId) { issues.push({ path: r.path, rule: 'not_found' }); return; }
      if (d.deleted_at) { issues.push({ path: r.path, rule: 'deleted' }); return; }
      if (r.entity !== 'Project' && d.project_id && ownProject && d.project_id !== ownProject) {
        issues.push({ path: r.path, rule: 'other_project' });
      }
    });
    if (value.client_id && value.project_id) {
      const p = byKey.get(`Project/${value.project_id}`);
      if (p && p.client_id !== value.client_id) issues.push({ path: 'project_id', rule: 'other_client' });
    }
    if (issues.length) throw new VaultError(CODES.REFERENCE, `${entity}: referência inválida.`, { issues });
  }

  function uniqueKeys(ctx, entity, value) {
    return (SCHEMAS[entity].unique || []).map(fields => ({
      fields,
      key: sha256([ctx.tenantId, entity, fields.join('+'), canonical(fields.map(f => value[f]))].join('|')),
    }));
  }

  function auditEntry(ctx, { operation, entity, id, version, value, changed }) {
    return {
      tenant_id: ctx.tenantId,
      execution_id: ctx.executionId,
      actor: { type: ctx.actor.type, id: ctx.actor.id },
      operation,
      entity,
      entity_id: id,
      version,
      content_hash: sha256(canonical(value)),
      changed_fields: changed,
      entity_schema_version: SCHEMAS[entity].schemaVersion,
      schemaVersion: AUDIT_SCHEMA_VERSION,
      at: FV.serverTimestamp(),
    };
  }

  function assertId(entity, id) {
    if (typeof id !== 'string' || !idPattern(entity).test(id)) {
      throw new VaultError(CODES.VALIDATION, `${entity}: id inválido.`, { issues: [{ path: 'id', rule: 'pattern' }] });
    }
  }

  function assertExpectedVersion(v) {
    if (!Number.isInteger(v) || v < 1) {
      throw new VaultError(CODES.VALIDATION, 'expectedVersion é obrigatório (controle de concorrência).',
        { issues: [{ path: 'expectedVersion', rule: 'required' }] });
    }
  }

  async function loadForWrite(tx, ctx, entity, id, expectedVersion) {
    const ref = db.collection(SCHEMAS[entity].collection).doc(id);
    const snap = await tx.get(ref);
    if (!snap.exists || snap.data().tenant_id !== ctx.tenantId) throw new VaultError(CODES.NOT_FOUND, `${entity}: registro não encontrado.`);
    const current = snap.data();
    checkSchemaVersion(entity, current);
    if (current.version !== expectedVersion) {
      throw new VaultError(CODES.VERSION_CONFLICT, `${entity}: o registro mudou desde a leitura.`,
        { expectedVersion, currentVersion: current.version });
    }
    return { ref, current };
  }

  async function assertNoDependents(tx, ctx, entity, id) {
    const found = [];
    for (const dep of DEPENDENTS[entity]) {
      const q = db.collection(SCHEMAS[dep.entity].collection)
        .where('tenant_id', '==', ctx.tenantId)
        .where(dep.field, dep.array ? 'array-contains' : '==', id)
        .where('deleted_at', '==', null)
        .limit(1);
      const r = await tx.get(q);
      if (!r.empty && !(dep.entity === entity && r.docs[0].id === id)) found.push({ entity: dep.entity, field: dep.field });
    }
    if (found.length) {
      throw new VaultError(CODES.HAS_DEPENDENTS, `${entity}: há registros ativos que dependem deste.`, { dependents: found });
    }
  }

  function repoFor(entity) {
    const schema = SCHEMAS[entity];
    const col = db.collection(schema.collection);
    const refPattern = idPattern;

    /**
     * Cria um registro.
     * @param ctx  contexto de execução (createExecutionContext)
     * @param data  campos de domínio (metadados são do servidor e rejeitados)
     * @param {{ idempotencyKey?: string }} opts
     * @returns {{ record, replayed: boolean }}
     */
    async function create(ctx, data, { idempotencyKey } = {}) {
      assertContext(ctx);
      if (idempotencyKey !== undefined && (typeof idempotencyKey !== 'string' || !IDEMPOTENCY_KEY_RE.test(idempotencyKey))) {
        throw new VaultError(CODES.VALIDATION, 'idempotencyKey inválida.', { issues: [{ path: 'idempotencyKey', rule: 'pattern' }] });
      }
      const result = validateEntity(schema, data, { refPattern });
      throwIfInvalid(entity, result);
      const value = stripNulls(result.value);
      const id = newId(schema.idPrefix);
      const requestHash = sha256(canonical(value));
      const uniques = uniqueKeys(ctx, entity, value);

      const outcome = await db.runTransaction(async tx => {
        // Todas as leituras antes das escritas (exigência do Firestore).
        await assertTenant(tx, ctx.tenantId);
        let idemRef = null;
        if (idempotencyKey) {
          idemRef = db.collection(IDEMPOTENCY_COLLECTION).doc(sha256([ctx.tenantId, entity, idempotencyKey].join('|')));
          const idem = await tx.get(idemRef);
          if (idem.exists) {
            if (idem.data().request_hash !== requestHash) {
              throw new VaultError(CODES.IDEMPOTENCY_CONFLICT, `${entity}: idempotencyKey já usada com outro conteúdo.`);
            }
            return { replayedId: idem.data().entity_id };
          }
        }
        const uniqueSnaps = await Promise.all(uniques.map(u => tx.get(db.collection(UNIQUE_COLLECTION).doc(u.key))));
        uniqueSnaps.forEach((s, i) => {
          if (s.exists) throw new VaultError(CODES.UNIQUE, `${entity}: já existe registro com o mesmo valor.`, { fields: uniques[i].fields });
        });
        await checkRefs(tx, ctx, entity, id, value, result.refs);

        const actor = { type: ctx.actor.type, id: ctx.actor.id };
        tx.create(col.doc(id), {
          ...value,
          id,
          tenant_id: ctx.tenantId,
          schemaVersion: schema.schemaVersion,
          version: 1,
          created_at: FV.serverTimestamp(),
          updated_at: FV.serverTimestamp(),
          deleted_at: null,
          created_by: actor,
          updated_by: actor,
          last_execution_id: ctx.executionId,
        });
        uniques.forEach(u => tx.create(db.collection(UNIQUE_COLLECTION).doc(u.key),
          { tenant_id: ctx.tenantId, entity, fields: u.fields, entity_id: id, created_at: FV.serverTimestamp() }));
        if (idemRef) {
          tx.create(idemRef, { tenant_id: ctx.tenantId, entity, entity_id: id, request_hash: requestHash,
            execution_id: ctx.executionId, created_at: FV.serverTimestamp() });
        }
        tx.create(db.collection(AUDIT_COLLECTION).doc(newId('aud')),
          auditEntry(ctx, { operation: 'create', entity, id, version: 1, value, changed: Object.keys(value).sort() }));
        return { id };
      });

      if (outcome.replayedId) return { record: await get(ctx, outcome.replayedId, { includeDeleted: true }), replayed: true };
      return { record: await get(ctx, outcome.id), replayed: false };
    }

    /** Lê um registro do tenant do contexto. Registros de outro tenant são NOT_FOUND. */
    async function get(ctx, id, { includeDeleted = false } = {}) {
      assertContext(ctx);
      assertId(entity, id);
      const snap = await col.doc(id).get();
      if (!snap.exists || snap.data().tenant_id !== ctx.tenantId) throw new VaultError(CODES.NOT_FOUND, `${entity}: registro não encontrado.`);
      if (snap.data().deleted_at && !includeDeleted) throw new VaultError(CODES.NOT_FOUND, `${entity}: registro não encontrado.`, { deleted: true });
      return toRecord(entity, snap);
    }

    /**
     * Lista registros ativos do tenant, mais recentes primeiro.
     * @param {{ where?: { client_id?|project_id?|status? }, limit?: number }} opts  no máximo um filtro
     */
    async function list(ctx, { where = {}, limit = 50 } = {}) {
      assertContext(ctx);
      const keys = Object.keys(where);
      const bad = keys.filter(k => !LIST_FILTERS.includes(k) || !schema.fields[k]);
      if (bad.length || keys.length > 1) {
        throw new VaultError(CODES.VALIDATION, `${entity}: filtro de listagem não suportado.`,
          { issues: (bad.length ? bad : keys).map(path => ({ path, rule: 'filter' })) });
      }
      if (!Number.isInteger(limit) || limit < 1 || limit > LIST_MAX) {
        throw new VaultError(CODES.VALIDATION, 'limit fora da faixa.', { issues: [{ path: 'limit', rule: 'range' }] });
      }
      let q = col.where('tenant_id', '==', ctx.tenantId).where('deleted_at', '==', null);
      for (const k of keys) {
        const def = schema.fields[k];
        const ok = def.kind === 'ref' ? refPattern(def.entity).test(where[k]) : def.values.includes(where[k]);
        if (!ok) throw new VaultError(CODES.VALIDATION, `${entity}: valor de filtro inválido.`, { issues: [{ path: k, rule: 'filter' }] });
        q = q.where(k, '==', where[k]);
      }
      const r = await q.orderBy('updated_at', 'desc').limit(limit).get();
      return r.docs.map(d => toRecord(entity, d));
    }

    /**
     * Atualiza campos de domínio. Exige expectedVersion (concorrência otimista).
     * null remove um campo opcional. Campos imutáveis não podem mudar.
     */
    async function update(ctx, id, patch, { expectedVersion } = {}) {
      assertContext(ctx);
      assertId(entity, id);
      assertExpectedVersion(expectedVersion);
      const partial = validateEntity(schema, patch, { partial: true, refPattern });
      throwIfInvalid(entity, partial);
      if (!Object.keys(patch).length) {
        throw new VaultError(CODES.VALIDATION, `${entity}: nada para atualizar.`, { issues: [{ path: '', rule: 'empty_patch' }] });
      }

      await db.runTransaction(async tx => {
        await assertTenant(tx, ctx.tenantId);
        const { ref, current } = await loadForWrite(tx, ctx, entity, id, expectedVersion);
        if (current.deleted_at) throw new VaultError(CODES.DELETED, `${entity}: registro está excluído (soft-delete).`);
        const before = domainOf(schema, current);
        const immutableIssues = Object.keys(patch)
          .filter(k => schema.fields[k].immutable && canonical(partial.value[k] ?? null) !== canonical(before[k] ?? null))
          .map(path => ({ path, rule: 'immutable' }));
        if (immutableIssues.length) throw new VaultError(CODES.VALIDATION, `${entity}: campo imutável.`, { issues: immutableIssues });

        // Revalida o documento resultante completo (obrigatórios, checks, refs).
        const full = validateEntity(schema, { ...before, ...partial.value }, { refPattern });
        throwIfInvalid(entity, full);
        const value = stripNulls(full.value);
        const changed = [...new Set([...Object.keys(before), ...Object.keys(value)])]
          .filter(k => canonical(before[k] ?? null) !== canonical(value[k] ?? null)).sort();

        const oldU = uniqueKeys(ctx, entity, before);
        const newU = uniqueKeys(ctx, entity, value);
        const moved = newU.filter((u, i) => u.key !== oldU[i].key);
        const uSnaps = await Promise.all(moved.map(u => tx.get(db.collection(UNIQUE_COLLECTION).doc(u.key))));
        uSnaps.forEach((s, i) => {
          if (s.exists) throw new VaultError(CODES.UNIQUE, `${entity}: já existe registro com o mesmo valor.`, { fields: moved[i].fields });
        });
        await checkRefs(tx, ctx, entity, id, value, full.refs);

        const version = current.version + 1;
        const meta = Object.fromEntries(META_FIELDS.filter(k => current[k] !== undefined).map(k => [k, current[k]]));
        tx.set(ref, {
          ...value,
          ...meta,
          version,
          updated_at: FV.serverTimestamp(),
          updated_by: { type: ctx.actor.type, id: ctx.actor.id },
          last_execution_id: ctx.executionId,
        });
        newU.forEach((u, i) => {
          if (u.key === oldU[i].key) return;
          tx.delete(db.collection(UNIQUE_COLLECTION).doc(oldU[i].key));
          tx.create(db.collection(UNIQUE_COLLECTION).doc(u.key),
            { tenant_id: ctx.tenantId, entity, fields: u.fields, entity_id: id, created_at: FV.serverTimestamp() });
        });
        tx.create(db.collection(AUDIT_COLLECTION).doc(newId('aud')),
          auditEntry(ctx, { operation: 'update', entity, id, version, value, changed }));
      });
      return get(ctx, id);
    }

    /** Soft-delete. Bloqueado (HAS_DEPENDENTS) se algum registro ativo referencia este. */
    async function softDelete(ctx, id, { expectedVersion } = {}) {
      assertContext(ctx);
      assertId(entity, id);
      assertExpectedVersion(expectedVersion);
      await db.runTransaction(async tx => {
        await assertTenant(tx, ctx.tenantId);
        const { ref, current } = await loadForWrite(tx, ctx, entity, id, expectedVersion);
        if (current.deleted_at) throw new VaultError(CODES.DELETED, `${entity}: registro já está excluído.`);
        await assertNoDependents(tx, ctx, entity, id);
        const version = current.version + 1;
        tx.update(ref, {
          version,
          deleted_at: FV.serverTimestamp(),
          updated_at: FV.serverTimestamp(),
          updated_by: { type: ctx.actor.type, id: ctx.actor.id },
          last_execution_id: ctx.executionId,
        });
        tx.create(db.collection(AUDIT_COLLECTION).doc(newId('aud')),
          auditEntry(ctx, { operation: 'soft_delete', entity, id, version, value: domainOf(schema, current), changed: ['deleted_at'] }));
      });
      return get(ctx, id, { includeDeleted: true });
    }

    /** Restaura um registro soft-deleted; as referências precisam continuar válidas. */
    async function restore(ctx, id, { expectedVersion } = {}) {
      assertContext(ctx);
      assertId(entity, id);
      assertExpectedVersion(expectedVersion);
      await db.runTransaction(async tx => {
        await assertTenant(tx, ctx.tenantId);
        const { ref, current } = await loadForWrite(tx, ctx, entity, id, expectedVersion);
        if (!current.deleted_at) {
          throw new VaultError(CODES.VALIDATION, `${entity}: registro não está excluído.`, { issues: [{ path: 'deleted_at', rule: 'not_deleted' }] });
        }
        const value = domainOf(schema, current);
        const full = validateEntity(schema, value, { refPattern });
        throwIfInvalid(entity, full);
        await checkRefs(tx, ctx, entity, id, full.value, full.refs);
        const version = current.version + 1;
        tx.update(ref, {
          version,
          deleted_at: null,
          updated_at: FV.serverTimestamp(),
          updated_by: { type: ctx.actor.type, id: ctx.actor.id },
          last_execution_id: ctx.executionId,
        });
        tx.create(db.collection(AUDIT_COLLECTION).doc(newId('aud')),
          auditEntry(ctx, { operation: 'restore', entity, id, version, value, changed: ['deleted_at'] }));
      });
      return get(ctx, id);
    }

    /** Trilha de auditoria do registro (somente metadados, sem valores). */
    async function history(ctx, id) {
      assertContext(ctx);
      assertId(entity, id);
      const r = await db.collection(AUDIT_COLLECTION)
        .where('tenant_id', '==', ctx.tenantId).where('entity_id', '==', id)
        .orderBy('version', 'asc').get();
      return r.docs.map(d => toPlain(d.data()));
    }

    return Object.freeze({ entity, collection: schema.collection, create, get, list, update, softDelete, restore, history });
  }

  return Object.freeze(Object.fromEntries(ENTITY_NAMES.map(e => [e, repoFor(e)])));
}

module.exports = {
  createVault, DEPENDENTS, META_FIELDS, LIST_FILTERS,
  AUDIT_COLLECTION, IDEMPOTENCY_COLLECTION, UNIQUE_COLLECTION, IDEMPOTENCY_KEY_RE,
};
