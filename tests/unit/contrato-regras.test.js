const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('regras.ts inclui menu Cota das IAs no grupo Sistema', t => {
  const filePath = path.join(__dirname, '../../src/pages/central/kernex/regras.ts');
  const content = fs.readFileSync(filePath, 'utf8');

  // 1. Verifica importação do componente CotaIas
  assert.match(
    content,
    /import\s+.*CotaIas.*from\s+['"][^'\"]*CotaIas['\"]/,
    'Deve importar o componente CotaIas'
  );

  // 2. Verifica presença da entrada de menu no grupo Sistema
  assert.match(
    content,
    /{[^}]*group:\s*['\"]Sistema['\"][^}]*title:\s*['\"]Cota das IAs['\"]/,
    'Deve existir a entrada de menu "Cota das IAs" dentro do grupo Sistema'
  );

  // 3. Verifica que a rota exportada está correta
  assert.match(
    content,
    /path:\s*['\"]\/cota-ias['\"]/,
    'Deve exportar a rota "/cota-ias" para a nova entrada'
  );
});