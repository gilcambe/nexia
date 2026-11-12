const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('LEIA-ME.md deve ser criado corretamente', t => {
  const filePath = path.join(__dirname, '../../modelos-projeto/site/LEIA-ME.md');

  // 1. O arquivo deve existir
  assert.ok(fs.existsSync(filePath), 'O arquivo LEIA-ME.md deve existir');

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/).filter(l => l.length > 0);

  // 2. Deve ter no máximo 5 linhas
  assert.ok(lines.length <= 5, `O arquivo deve conter no máximo 5 linhas, encontrado ${lines.length}`);

  // 3. Deve conter a palavra "modelo"
  assert.ok(content.includes('modelo'), 'O conteúdo deve mencionar "modelo"');

  // 4. Deve conter a palavra "versão"
  assert.ok(content.includes('versão'), 'O conteúdo deve mencionar "versão"');

  // 5. Deve conter a palavra "variáveis"
  assert.ok(content.includes('variáveis'), 'O conteúdo deve mencionar "variáveis"');
});