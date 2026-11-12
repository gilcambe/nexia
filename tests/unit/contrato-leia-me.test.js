const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('LEIA-ME.md deve atender ao contrato', t => {
  const filePath = path.join(__dirname, '../../modelos-projeto/painel/LEIA-ME.md');
  const content = fs.readFileSync(filePath, 'utf8');

  // Conta apenas linhas com conteúdo (ignora linhas vazias)
  const linhas = content.split(/\r?\n/).filter(l => l.trim().length > 0);

  // 1) Não pode ter mais que 5 linhas de texto
  assert.ok(linhas.length <= 5, `O arquivo possui ${linhas.length} linhas, excedendo o limite de 5.`);

  // 2) Deve mencionar os arquivos obrigatórios
  const obrigatorios = ['index.html', 'painel.js', 'dados-exemplo.json'];
  obrigatorios.forEach(palavra => {
    assert.ok(content.includes(palavra), `O arquivo não menciona "${palavra}".`);
  });

  // 3) Não pode conter palavras proibidas
  const proibidas = ['TODO', 'FIXME', 'HACK'];
  proibidas.forEach(palavra => {
    assert.ok(!content.includes(palavra), `Palavra proibida encontrada: "${palavra}".`);
  });
});