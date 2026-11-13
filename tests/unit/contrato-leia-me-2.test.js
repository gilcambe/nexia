const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const readmePath = path.join(__dirname, '../../modelos-projeto/hostinger-php/LEIA-ME.md');

test('LEIA-ME.md deve existir e ter ≤5 linhas', t => {
  // Caso comum: arquivo existe
  assert.ok(fs.existsSync(readmePath), 'Arquivo LEIA-ME.md não encontrado');

  const content = fs.readFileSync(readmePath, 'utf8');
  // Borda: número de linhas <=5 (ignorando linhas vazias finais)
  const lines = content.split(/\r?\n/).filter(l => l.length > 0);
  assert.ok(lines.length <= 5, `O arquivo tem ${lines.length} linhas, excedendo o limite de 5`);

  // Entrada inválida: conteúdo deve conter a palavra "Hostinger"
  assert.ok(content.includes('Hostinger'), 'Conteúdo não menciona "Hostinger"');
});

test('Leitura de caminho inválido deve lançar erro', t => {
  const invalidPath = path.join(__dirname, '../../modelos-projeto/hostinger-php/NÃO_EXISTE.md');
  assert.throws(() => fs.readFileSync(invalidPath, 'utf8'), {
    code: 'ENOENT'
  });
});