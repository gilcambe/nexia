const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('estilo.css deve conter os estilos esperados', (t) => {
  const cssPath = path.join(__dirname, '../../modelos-projeto/painel/estilo.css');
  const content = fs.readFileSync(cssPath, 'utf8');

  // Caso comum: .grafico tem max-width: 100%;
  assert.ok(/\.grafico\s*\{[^}]*max-width\s*:\s*100%\s*;/.test(content),
    'Deve existir a regra .grafico { max-width: 100%; }');

  // Caso de borda: .barra tem display: flex; para responsividade
  assert.ok(/\.barra\s*\{[^}]*display\s*:\s*flex\s*;/.test(content),
    'Deve existir a regra .barra { display: flex; }');

  // Entrada inválida / regra antiga removida: .grafico não deve ter width: auto;
  assert.ok(!/\.grafico\s*\{[^}]*width\s*:\s*auto\s*;/.test(content),
    'Não deve conter a regra .grafico { width: auto; }');
});