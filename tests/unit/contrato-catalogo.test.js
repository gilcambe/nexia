const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Caminho relativo ao diretório do teste
const catalogPath = path.join(__dirname, '../../nexia-ai/fabrica/catalogo.json');

/**
 * Helper para carregar o catálogo como objeto JavaScript.
 */
function loadCatalog() {
  const raw = fs.readFileSync(catalogPath, 'utf8');
  return JSON.parse(raw);
}

test('catalogo.json deve conter a nova entrada "Cota das IAs"', t => {
  const catalog = loadCatalog();

  // Caso comum: o catálogo deve ser um array ou objeto que contém a chave id
  assert.ok(Array.isArray(catalog) || typeof catalog === 'object', 'catalogo deve ser array ou objeto');

  // Encontra a entrada pelo id esperado
  const newEntry = Array.isArray(catalog)
    ? catalog.find(e => e.id === 'cota-das-ias')
    : catalog['cota-das-ias'];

  // Asserção 1 – a entrada existe
  assert.ok(newEntry, 'Entrada "cota-das-ias" deve existir no catálogo');

  // Asserção 2 – campos obrigatórios com valores concretos
  assert.strictEqual(newEntry.id, 'cota-das-ias', 'Campo id deve ser "cota-das-ias"');
  assert.strictEqual(newEntry.nome, 'Cota das IAs', 'Campo nome deve ser "Cota das IAs"');
  assert.strictEqual(newEntry.pronto, true, 'Campo pronto deve ser true');
  assert.strictEqual(newEntry.origem, 'nexia-ai', 'Campo origem deve ser "nexia-ai"');
  assert.strictEqual(newEntry.onde, 'fabrica', 'Campo onde deve ser "fabrica"');

  // Asserção 3 – caso de borda: apelidos e nichos podem ser arrays vazios, mas devem existir
  assert.ok(Array.isArray(newEntry.apelidos), 'Campo apelidos deve ser um array');
  assert.ok(Array.isArray(newEntry.nichos), 'Campo nichos deve ser um array');

  // Asserção 4 – entrada inválida (campo inexistente) não deve estar presente
  assert.strictEqual(newEntry.inexistente, undefined, 'Campo inexistente não deve existir na nova entrada');

  // Asserção 5 – garantir que o número total de entradas aumentou em 1 em relação ao backup
  // (simula leitura de um snapshot anterior sem a nova entrada)
  const snapshotPath = path.join(__dirname, 'snapshot_catalogo.json');
  if (fs.existsSync(snapshotPath)) {
    const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
    const snapshotCount = Array.isArray(snapshot) ? snapshot.length : Object.keys(snapshot).length;
    const currentCount = Array.isArray(catalog) ? catalog.length : Object.keys(catalog).length;
    assert.strictEqual(currentCount, snapshotCount + 1, 'O catálogo deve ter exatamente uma entrada a mais que o snapshot');
  }
});