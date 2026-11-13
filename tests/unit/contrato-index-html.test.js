const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const filePath = path.join(__dirname, '../../modelos-projeto/painel/index.html');

test('index.html deve conter atributos e placeholders corretos', t => {
  const content = fs.readFileSync(filePath, 'utf8');

  // Caso comum: presença dos elementos essenciais
  assert.ok(/<html[^>]*\blang=["']pt-BR["']/.test(content), 'O elemento <html> deve ter lang="pt-BR"');
  assert.ok(/<meta\s+name=["']viewport["']\s+content=["']width=device-width,\s*initial-scale=1["']/.test(content), 'Meta viewport deve estar presente');
  assert.ok(/<link\s+rel=["']stylesheet["']\s+href=["']estilo\.css["']/.test(content), 'Deve existir link para estilo.css');
  assert.ok(/<script\s+src=["']painel\.js["']/.test(content), 'Deve existir script apontando para painel.js');

  // Caso de borda: placeholders corretos e nenhum {{}} restante
  const placeholders = ['{{nome}}', '{{titulo}}', '{{cor}}'];
  placeholders.forEach(ph => {
    assert.ok(content.includes(ph), `Placeholder ${ph} deve estar presente`);
  });
  // Remove os placeholders permitidos e verifica se não sobram outros
  const sanitized = content.replace(/{{\s*(nome|titulo|cor)\s*}}/g, '');
  assert.ok(!/{{\s*[^}]+\s*}}/.test(sanitized), 'Não deve haver outros padrões {{}} no arquivo');

  // Entrada inválida: garantir que não existam atributos lang diferentes
  assert.ok(!/\blang=["'][^"']+["']/.test(content) || /lang=["']pt-BR["']/.test(content), 'O atributo lang deve ser exatamente pt-BR');
});