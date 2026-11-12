const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Caso comum: o arquivo deve existir e conter os elementos esperados
test('index.html deve existir e conter atributos e placeholders requeridos', t => {
  const filePath = path.join(__dirname, '../../modelos-projeto/crud/index.html');
  const content = fs.readFileSync(filePath, 'utf8');

  // Verifica atributos obrigatórios
  assert.ok(content.includes('lang="pt-BR"'), 'atributo lang="pt-BR" ausente');
  assert.ok(content.includes('<meta name="viewport"'), 'meta viewport ausente');
  assert.ok(content.includes('<link rel="stylesheet" href="estilo.css"'), 'referência a estilo.css ausente');
  assert.ok(content.includes('<script src="crud.js"'), 'referência a crud.js ausente');

  // Verifica placeholders que o script gerar-de-modelo.js substituirá
  assert.ok(content.includes('{{nome}}'), 'placeholder {{nome}} ausente');
  assert.ok(content.includes('{{titulo}}'), 'placeholder {{titulo}} ausente');
  assert.ok(content.includes('{{campos}}'), 'placeholder {{campos}} ausente');
  assert.ok(content.includes('{{cor}}'), 'placeholder {{cor}} ausente');
});

// Caso de borda: leitura de um caminho que não existe deve lançar ENOENT
test('leitura de arquivo inexistente deve lançar erro ENOENT', t => {
  const badPath = path.join(__dirname, '../../modelos-projeto/crud/nao-existe.html');
  assert.throws(() => {
    fs.readFileSync(badPath, 'utf8');
  }, { code: 'ENOENT' });
});
