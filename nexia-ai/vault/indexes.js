'use strict';
// Índices compostos do Vault (spec §25: client_id, project_id, status, timestamps).
// Gerados a partir dos schemas para não divergirem das consultas do repository.js.
//   node nexia-ai/vault/indexes.js           → imprime os índices
//   node nexia-ai/vault/indexes.js --write   → atualiza firestore.indexes.json (só entradas vault_*)
const fs = require('fs');
const path = require('path');
const { SCHEMAS } = require('./schemas');
const { LIST_FILTERS, DEPENDENTS, AUDIT_COLLECTION } = require('./repository');

function vaultIndexes() {
  const out = [];
  const add = (collectionGroup, fields) => out.push({ collectionGroup, queryScope: 'COLLECTION', fields });
  for (const s of Object.values(SCHEMAS)) {
    const base = [{ fieldPath: 'tenant_id', order: 'ASCENDING' }, { fieldPath: 'deleted_at', order: 'ASCENDING' }];
    const desc = { fieldPath: 'updated_at', order: 'DESCENDING' };
    // list() sem filtro e com um filtro
    add(s.collection, [...base, desc]);
    for (const f of LIST_FILTERS) if (s.fields[f]) add(s.collection, [...base, { fieldPath: f, order: 'ASCENDING' }, desc]);
  }
  // Verificação de dependentes com array-contains (soft-delete)
  for (const deps of Object.values(DEPENDENTS)) {
    for (const d of deps.filter(x => x.array)) {
      add(SCHEMAS[d.entity].collection, [
        { fieldPath: 'tenant_id', order: 'ASCENDING' },
        { fieldPath: 'deleted_at', order: 'ASCENDING' },
        { fieldPath: d.field, arrayConfig: 'CONTAINS' },
      ]);
    }
  }
  // history()
  add(AUDIT_COLLECTION, [
    { fieldPath: 'tenant_id', order: 'ASCENDING' },
    { fieldPath: 'entity_id', order: 'ASCENDING' },
    { fieldPath: 'version', order: 'ASCENDING' },
  ]);
  return out;
}

const INDEX_FILE = path.join(__dirname, '..', '..', 'firestore.indexes.json');
const isVault = ix => /^vault_/.test(ix.collectionGroup);

function mergedIndexFile() {
  const current = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
  return { ...current, indexes: [...current.indexes.filter(ix => !isVault(ix)), ...vaultIndexes()] };
}

if (require.main === module) {
  if (process.argv.includes('--write')) {
    fs.writeFileSync(INDEX_FILE, JSON.stringify(mergedIndexFile(), null, 2) + '\n');
    console.log(`firestore.indexes.json: ${vaultIndexes().length} índices vault_*`);
  } else {
    console.log(JSON.stringify(vaultIndexes(), null, 2));
  }
}

module.exports = { vaultIndexes, mergedIndexFile, INDEX_FILE, isVault };
