'use strict';
// Destino grátis da trilha de auditoria no GitHub Actions: arquivo JSONL (só metadados, sem valores).
// Tira 1 escrita do Firestore por operação do Vault (cota grátis de 20 mil escritas por dia).
const fs = require('fs');

function createFileAuditSink(file) {
  if (!file) return null;
  return { append: async entry => { fs.appendFileSync(file, `${JSON.stringify(entry)}\n`); } };
}

module.exports = { createFileAuditSink };
