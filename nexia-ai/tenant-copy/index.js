'use strict';
// Duplicar tenant (ADR-CLONE-01, como o "duplicate station" do Avaya CM): copia a CONFIGURAÇÃO de um tenant
// para um tenant novo, com ids novos e referências remapeadas. Copia: ajustes do tenant (settings, config,
// modules), clientes, projetos, repositórios, ambientes, políticas de ferramentas e robôs (se houver).
// NUNCA copia: segredos/credenciais (nem as referências secret_refs), usuários e membros, convites,
// execuções, chamadas de ferramenta, auditoria, cobrança/pagamentos, dados pessoais (contatos, leads,
// inscritos...). Os registros do Vault passam pelo próprio Vault (validação, detector de segredo, auditoria).
const crypto = require('crypto');
const { createExecutionContext } = require('../vault/execution');
const { SCHEMAS } = require('../vault/schemas');
const { VaultError, CODES } = require('../vault/errors');
const { detectSecret } = require('../vault/secrets');
const { canonical } = require('../vault/validate');
const { AUDIT_COLLECTION } = require('../vault/repository');

const TENANT_RE = /^[a-z0-9][a-z0-9_-]{0,62}$/;
// Ordem importa: quem é referenciado vem antes.
const INCLUDE = ['settings', 'clients', 'projects', 'repositories', 'environments', 'tool-policies', 'robots'];
const ENTITY = { clients: 'Client', projects: 'Project', repositories: 'Repository', environments: 'Environment', 'tool-policies': 'ToolPolicy' };
const NEEDS = { projects: ['clients'], repositories: ['projects'], environments: ['projects'], 'tool-policies': ['projects'] };
// Campos de configuração do documento do tenant (o resto, como dono, plano, cobrança e domínio, fica de fora).
const TENANT_KEYS = ['settings', 'branding', 'brand', 'theme', 'features', 'modules', 'locale', 'language', 'timezone', 'currency', 'country', 'segment', 'vertical', 'industry'];
// Subcoleções de configuração do tenant (doc id preservado).
const TENANT_SUBS = { settings: ['config', 'modules'], robots: ['robots'] };
// Campos de domínio que nunca vão para o tenant novo.
const DROP_FIELDS = {
  Client: ['contacts', 'notes'],          // nomes de pessoas e anotações livres (dados pessoais)
  Environment: ['secret_refs'],           // apontam para segredos do tenant de origem
  Project: ['primary_repository_id'],     // remapeado depois que os repositórios existem
};
const NEVER = ['segredos e credenciais (inclusive secret_refs)', 'usuários, membros e convites', 'execuções e chamadas de ferramenta',
  'auditoria', 'cobrança, plano e pagamentos', 'dados pessoais (contatos, leads, inscritos, clientes finais)', 'domínio próprio'];
const SENSITIVE_KEY = /(secret|token|passw|senha|api_?key|apikey|credential|private|webhook|cookie|session|auth|bearer|card|cartao|cpf|cnpj|rg$|email|e_mail|phone|telefone|celular|whatsapp|owner|member|invite|convite|billing|payment|pagamento|subscription|assinatura|customer|stripe|mercado|invoice|fatura|plan$|planlimits|domain|dominio|ip$|address|endereco)/i;
const MAX_LIST = 200;

const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');
const newId = prefix => `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;

/**
 * Tira de um objeto de configuração tudo o que pode ser segredo ou dado pessoal: chaves com nome sensível,
 * textos que o detector de segredo reconhece, carimbos de data. Devolve também os caminhos removidos (sem valores).
 */
function sanitize(value, pathPrefix = '', removed = [], depth = 0) {
  if (value === null || value === undefined) return value;
  if (typeof value.toDate === 'function' || value instanceof Date) { removed.push(pathPrefix); return undefined; }
  if (depth > 6) { removed.push(pathPrefix); return undefined; }
  if (typeof value === 'string') {
    if (detectSecret(value).length || /\b[\w.+-]+@[\w-]+\.[\w.]+\b/.test(value)) { removed.push(pathPrefix); return undefined; }
    return value.slice(0, 4000);
  }
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, 200).map((v, i) => sanitize(v, `${pathPrefix}[${i}]`, removed, depth + 1)).filter(v => v !== undefined);
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    const p = pathPrefix ? `${pathPrefix}.${k}` : k;
    if (SENSITIVE_KEY.test(k) || /^(created|updated|deleted)(At|_at|_by|By)$/.test(k)) { removed.push(p); continue; }
    const s = sanitize(v, p, removed, depth + 1);
    if (s !== undefined) out[k] = s;
  }
  return out;
}

/** include pedido → lista válida na ordem certa, com as dependências (ex.: projetos puxam clientes). */
function resolveInclude(include) {
  const asked = include === undefined ? INCLUDE : include;
  if (!Array.isArray(asked) || asked.some(x => !INCLUDE.includes(x))) {
    throw new VaultError(CODES.VALIDATION, `include: use uma lista com ${INCLUDE.join(', ')}.`, { issues: [{ path: 'include', rule: 'enum' }] });
  }
  const set = new Set(asked);
  for (let changed = true; changed;) {
    changed = false;
    for (const x of [...set]) for (const d of NEEDS[x] || []) if (!set.has(d)) { set.add(d); changed = true; }
  }
  return { include: INCLUDE.filter(x => set.has(x)), added: INCLUDE.filter(x => set.has(x) && !asked.includes(x)) };
}

/** Campos de domínio do registro do Vault, sem os que nunca são copiados e sem textos com cara de segredo. */
function domainCopy(entity, record, removed) {
  const out = {};
  for (const k of Object.keys(SCHEMAS[entity].fields)) {
    if (record[k] === undefined || record[k] === null) continue;
    if ((DROP_FIELDS[entity] || []).includes(k)) { if (k !== 'primary_repository_id' && (!Array.isArray(record[k]) || record[k].length)) removed.push(`${entity}.${k}`); continue; }
    out[k] = record[k];
  }
  return out;
}

/**
 * Plano da cópia (puro): o que será criado no tenant novo e o que fica de fora.
 * @param {{ tenant: object, subs: Record<string, Array<{id, data}>>, records: Record<string, object[]> }} src
 */
function buildPlan(src, { include, name, target }) {
  const removed = [];
  const plan = { tenant: null, subs: {}, records: {}, removed, truncated: [] };
  const base = {};
  if (include.includes('settings')) {
    for (const k of TENANT_KEYS) if (src.tenant[k] !== undefined) base[k] = src.tenant[k];
  }
  plan.tenant = { ...sanitize(base, '', removed), slug: target, name };
  for (const [opt, subs] of Object.entries(TENANT_SUBS)) {
    if (!include.includes(opt)) continue;
    for (const sub of subs) {
      plan.subs[sub] = (src.subs[sub] || []).map(d => ({ id: d.id, data: sanitize(d.data, `${sub}/${d.id}`, removed) })).filter(d => d.data && Object.keys(d.data).length);
    }
  }
  for (const [opt, entity] of Object.entries(ENTITY)) {
    if (!include.includes(opt)) continue;
    const list = src.records[opt] || [];
    if (list.length >= MAX_LIST) plan.truncated.push(opt);
    plan.records[opt] = list.map(r => ({ source_id: r.id, data: domainCopy(entity, r, removed), primary_repository_id: entity === 'Project' ? r.primary_repository_id || null : undefined }));
  }
  plan.removed = [...new Set(removed)];
  return plan;
}

const label = r => r.data.name || r.data.slug || (r.data.owner ? `${r.data.owner}/${r.data.repo}` : '') || r.source_id;

/** Resumo do plano para a resposta (sem valores de configuração). */
function describe(plan) {
  return {
    tenant: { fields: Object.keys(plan.tenant).filter(k => !['slug', 'name'].includes(k)) },
    subcollections: Object.fromEntries(Object.entries(plan.subs).map(([k, v]) => [k, v.map(d => d.id)])),
    records: Object.fromEntries(Object.entries(plan.records).map(([k, v]) => [k, v.map(r => ({ source_id: r.source_id, label: String(label(r)).slice(0, 120) }))])),
    counts: Object.fromEntries(Object.entries(plan.records).map(([k, v]) => [k, v.length])),
    omitted_fields: plan.removed.slice(0, 100),
    truncated: plan.truncated,
    never_copied: NEVER,
  };
}

/**
 * Duplica a configuração de um tenant.
 * stage: 'all' (tudo agora), 'prepare' (só cria o tenant novo como "queued" e devolve o plano; a cópia vai para a
 * fila do GitHub Actions, porque o Worker grátis permite 50 chamadas por pedido) ou 'resume' (a tarefa da fila
 * continua um tenant "queued" com o mesmo nome e include gravados no 'prepare').
 * @param {{ db, vault, FieldValue?, source: string, target: string, name?: string, include?: string[], dryRun?: boolean,
 *   stage?: 'all'|'prepare'|'resume', actor: { type, id } }} o
 */
async function duplicateTenant({ db, vault, FieldValue, source, target, name, include, dryRun = false, stage = 'all', actor }) {
  const FV = FieldValue || require('../../lib/firebase-lite').FieldValue;
  const bad = (path, msg) => { throw new VaultError(CODES.VALIDATION, msg, { issues: [{ path, rule: 'invalid' }] }); };
  if (!TENANT_RE.test(String(source || ''))) bad('id', 'Tenant de origem inválido.');
  if (!TENANT_RE.test(String(target || ''))) bad('new_tenant', 'new_tenant inválido (a-z, 0-9, _ e -, até 63).');
  if (source === target) bad('new_tenant', 'new_tenant precisa ser diferente do tenant de origem.');
  if (name !== undefined && (typeof name !== 'string' || !name.trim() || name.length > 100)) bad('name', 'name: texto de 1 a 100 caracteres.');
  const srcSnap = await db.collection('tenants').doc(source).get();
  if (!srcSnap.exists) throw new VaultError(CODES.TENANT_NOT_FOUND, 'Tenant de origem não existe.');
  const tgtSnap = await db.collection('tenants').doc(target).get();
  let queued = null;
  if (stage === 'resume') {
    queued = tgtSnap.exists ? tgtSnap.data() : null;
    if (!queued || queued.duplicatedFrom !== source || queued.duplicationStatus !== 'queued') {
      throw new VaultError(CODES.VALIDATION, 'Não há duplicação na fila para esse tenant.', { issues: [{ path: 'new_tenant', rule: 'not_queued' }] });
    }
  } else if (tgtSnap.exists) throw new VaultError(CODES.UNIQUE, 'Já existe um tenant com esse id.', { fields: ['new_tenant'] });
  const inc = resolveInclude(queued ? queued.duplicationInclude : include);
  const srcData = srcSnap.data() || {};
  const finalName = String((queued ? queued.name : name) || `${srcData.name || source} (cópia)`).trim().slice(0, 100);

  const srcCtx = createExecutionContext({ tenantId: source, actor });
  const src = { tenant: srcData, subs: {}, records: {} };
  for (const [opt, subs] of Object.entries(TENANT_SUBS)) {
    if (!inc.include.includes(opt)) continue;
    for (const sub of subs) {
      const snap = await db.collection('tenants').doc(source).collection(sub).limit(100).get();
      src.subs[sub] = snap.docs.map(d => ({ id: d.id, data: d.data() }));
    }
  }
  for (const [opt, entity] of Object.entries(ENTITY)) {
    if (inc.include.includes(opt)) src.records[opt] = await vault[entity].list(srcCtx, { limit: MAX_LIST });
  }
  const plan = buildPlan(src, { include: inc.include, name: finalName, target });
  const summary = { source, target, name: finalName, include: inc.include, added_dependencies: inc.added, ...describe(plan) };
  if (dryRun) return { dry_run: true, ...summary };

  // 1) tenant novo (falha se alguém criou o mesmo id no meio do caminho); na retomada, marca como "running"
  await db.runTransaction(async tx => {
    const ref = db.collection('tenants').doc(target);
    const cur = await tx.get(ref);
    if (stage === 'resume') {
      if (!cur.exists || cur.data().duplicationStatus !== 'queued') throw new VaultError(CODES.VERSION_CONFLICT, 'A duplicação já foi iniciada por outra tarefa.');
      tx.update(ref, { duplicationStatus: 'running', updatedAt: FV.serverTimestamp() });
      return;
    }
    if (cur.exists) throw new VaultError(CODES.UNIQUE, 'Já existe um tenant com esse id.', { fields: ['new_tenant'] });
    tx.create(ref, { ...plan.tenant, status: 'active', plan: 'free', membersCount: 0, duplicatedFrom: source, duplicationStatus: stage === 'prepare' ? 'queued' : 'running',
      duplicationInclude: inc.include, createdAt: FV.serverTimestamp(), updatedAt: FV.serverTimestamp() });
  });
  if (stage === 'prepare') return { dry_run: false, queued: true, ...summary };
  const tgtCtx = createExecutionContext({ tenantId: target, actor, executionId: srcCtx.executionId });
  const idMap = {};
  const created = {};
  try {
    for (const [sub, docs] of Object.entries(plan.subs)) {
      for (const d of docs) await db.collection('tenants').doc(target).collection(sub).doc(d.id).set({ ...d.data, updatedAt: FV.serverTimestamp() });
      created[sub] = docs.length;
    }
    const remap = data => {
      const out = { ...data };
      for (const k of ['client_id', 'project_id']) if (out[k]) out[k] = idMap[out[k]];
      return out;
    };
    for (const [opt, entity] of Object.entries(ENTITY)) {
      if (!plan.records[opt]) continue;
      created[opt] = 0;
      for (const r of plan.records[opt]) {
        const data = remap(r.data);
        if ((data.client_id === undefined && r.data.client_id) || (data.project_id === undefined && r.data.project_id)) continue; // pai não copiado
        const { record } = await vault[entity].create(tgtCtx, data);
        idMap[r.source_id] = record.id;
        created[opt]++;
      }
    }
    // Repositório principal de cada projeto, agora com os ids novos.
    for (const r of plan.records.projects || []) {
      const newRepo = r.primary_repository_id && idMap[r.primary_repository_id];
      if (newRepo && idMap[r.source_id]) await vault.Project.update(tgtCtx, idMap[r.source_id], { primary_repository_id: newRepo }, { expectedVersion: 1 });
    }
  } catch (e) {
    await db.collection('tenants').doc(target).update({ duplicationStatus: 'failed', updatedAt: FV.serverTimestamp() }).catch(() => {});
    if (e && typeof e === 'object') e.details = { ...(e.details || {}), partial: { target, created } };
    throw e;
  }
  await db.collection('tenants').doc(target).update({ duplicationStatus: 'done', updatedAt: FV.serverTimestamp() });

  // Auditoria (mesmo formato do Vault, sem valores): uma entrada no tenant novo e uma no de origem.
  const contentHash = sha256(canonical({ source, target, include: inc.include, created }));
  for (const [tenantId, operation] of [[target, 'duplicate_create'], [source, 'duplicate_source']]) {
    await db.collection(AUDIT_COLLECTION).doc(newId('aud')).set({
      tenant_id: tenantId, execution_id: srcCtx.executionId, actor: { type: actor.type, id: actor.id }, operation,
      entity: 'Tenant', entity_id: tenantId === target ? target : source, version: 1, content_hash: contentHash,
      changed_fields: inc.include, entity_schema_version: 1, schemaVersion: 1, at: FV.serverTimestamp(),
      source_tenant: source, target_tenant: target, counts: created,
    });
  }
  return { dry_run: false, ...summary, created, id_map: idMap, execution_id: srcCtx.executionId };
}

module.exports = { duplicateTenant, buildPlan, describe, sanitize, resolveInclude, INCLUDE, NEVER, TENANT_KEYS };
