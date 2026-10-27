'use strict';
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const dir = path.join(__dirname, '../../sites/splash/agenda');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const avisarJsContent = fs.readFileSync(path.join(dir, 'avisar.js'), 'utf8');

test('AVISAR: index.html inclui o script avisar.js e elementos da aba', () => {
  assert.ok(html.includes('<script src="avisar.js"></script>'), 'index.html deve carregar avisar.js');
  assert.ok(html.includes('href="#avisar"'), 'index.html deve conter link para #avisar');
  assert.ok(html.includes('id="aba-avisar"'), 'index.html deve conter a section id="aba-avisar"');
  assert.ok(html.includes("navegarAba('avisar')"), 'index.html deve chamar navegarAba("avisar")');
});

test('AVISAR: avisar.js define window.Avisar e métodos principais', () => {
  assert.ok(avisarJsContent.includes('window.Avisar = Avisar;'), 'avisar.js deve expor window.Avisar');
  assert.ok(avisarJsContent.includes('gerarQR('), 'avisar.js deve conter a função/método gerarQR');
  assert.ok(avisarJsContent.includes('baixarImagem()'), 'avisar.js deve conter o método baixarImagem');
  assert.ok(avisarJsContent.includes('compartilhar()'), 'avisar.js deve conter o método compartilhar');
  assert.ok(avisarJsContent.includes('canvas-preview'), 'avisar.js deve referenciar canvas-preview');
  assert.ok(avisarJsContent.includes('Modelo de Mudança do Instagram'), 'avisar.js deve incluir placeholder do Instagram');
  assert.ok(avisarJsContent.includes('Lista de Contatos'), 'avisar.js deve incluir placeholder de Lista de Contatos');
  assert.ok(avisarJsContent.includes('Histórico de Avisos'), 'avisar.js deve incluir placeholder de Histórico');
});
