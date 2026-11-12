const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Caminho relativo ao diretório do teste
const manifestPath = path.join(__dirname, '../../apps/body-coach/android/twa-manifest.json');

test('twa-manifest.json deve conter name "Body Coach" e packageId inalterado', t => {
  // Leitura do arquivo
  const raw = fs.readFileSync(manifestPath, 'utf8');

  // 1. O conteúdo deve ser JSON válido
  let manifest;
  try {
    manifest = JSON.parse(raw);
  } catch (e) {
    assert.fail('O conteúdo do twa-manifest.json não é JSON válido');
  }

  // 2. O campo name deve ser exatamente "Body Coach"
  assert.strictEqual(manifest.name, 'Body Coach', 'O campo "name" deve ser "Body Coach"');

  // 3. O campo packageId deve permanecer "app.nexia.bodycoach"
  assert.strictEqual(manifest.packageId, 'app.nexia.bodycoach', 'O campo "packageId" deve ser "app.nexia.bodycoach"');

  // 4. Garantir que o nome antigo não está presente (caso de regressão)
  assert.notStrictEqual(manifest.name, 'NEXIA Body Coach', 'O nome antigo não deve permanecer');
});
