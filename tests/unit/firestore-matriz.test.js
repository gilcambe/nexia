'use strict';
// #814 A matriz de permissões (tests/firestore-matriz.js) cobre toda coleção das regras e todo papel.
// Sem emulador: só confere a cobertura. A matriz roda de verdade em tests/integration/firestore-matriz.test.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { PAPEIS, USUARIOS, SEMENTES, MATRIZ } = require('../firestore-matriz');

const regras = fs.readFileSync(path.join(__dirname, '..', '..', 'firestore.rules'), 'utf8');

test('MZ1. papéis pedidos na issue (aluno, coach, dono, anônimo) e mais membro/admin de tenant', () => {
  for (const p of ['anon', 'aluno', 'coach', 'dono', 'membro', 'admin']) assert.ok(PAPEIS.includes(p), p);
  assert.equal(USUARIOS.dono.role, 'master');
  assert.equal(USUARIOS.anon, null);
  for (const l of MATRIZ) for (const p of l.pode) assert.ok(PAPEIS.includes(p), `${l.doc}: papel ${p}`);
});

test('MZ2. toda coleção com regra própria aparece na matriz', () => {
  const docs = MATRIZ.map((l) => l.doc);
  const tem = (re) => docs.some((d) => re.test(d));
  const topo = [...regras.matchAll(/^ {4}match \/([a-z_]+)\/\{/gm)].map((m) => m[1]).filter((c) => c !== 'databases');
  for (const c of new Set(topo)) assert.ok(tem(new RegExp(`^${c}(/|$)`)), `coleção ${c}`);
  const sub = /explicitTenantSubcollections\(\)\s*\{\s*return \[([^\]]+)\]/.exec(regras)[1].match(/'([a-z_]+)'/g).map((s) => s.slice(1, -1));
  const semLinha = sub.filter((c) => !tem(new RegExp(`^tenants/[^/]+/${c}/`)));
  assert.deepEqual(semLinha, [], 'subcoleções de tenant sem linha na matriz');
  const bc = /coll in \[([^\]]+)\]/.exec(regras)[1].match(/'([a-z_]+)'/g).map((s) => s.slice(1, -1));
  assert.ok(bc.length >= 6);
  assert.ok(tem(/^bodycoach_users\/aluno\/(meals|medical_exams|progress_entries|profile)/));
  assert.ok(tem(/^vault_/) && tem(/^tenants\/[^/]+\/clients\//), 'Vault e catch-all de tenant');
});

test('MZ3. dado de saúde do Body Coach é só do aluno; coleções do servidor ninguém lê pelo app', () => {
  for (const l of MATRIZ.filter((x) => x.doc.startsWith('bodycoach_users/'))) assert.ok(l.pode.every((p) => p === 'aluno'), l.doc);
  for (const c of ['bc_acesso', 'bc_diretorio', 'bc_conversas', 'bc_cupons', 'bc_push', 'cortex_logs']) {
    const ls = MATRIZ.filter((x) => x.doc.startsWith(c + '/'));
    assert.ok(ls.length >= 2 && ls.every((x) => x.pode.length === 0), c);
  }
  for (const l of MATRIZ) if (l.op !== 'create' && l.op !== 'list') assert.ok(SEMENTES[l.doc] || l.doc.startsWith('users/'), `semente para ${l.doc}`);
});

test('MZ4. regra do contador de cota e da auditoria: só o servidor grava (proposta do #814)', () => {
  assert.match(regras, /match \/usage\/\{docId\} \{\s*allow read: +if isAdminOfTenant\(tenantSlug\);\s*allow write: +if isMaster\(\);/);
  assert.match(regras, /match \/audit_log\/\{docId\} \{[\s\S]*?allow create: if false;/);
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'integration', 'firestore-matriz.test.js')));
});
