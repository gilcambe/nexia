'use strict';
// Workflow do modo lote (issue 3/5 de #2132): guarda a forma do arquivo para ninguém quebrar sem perceber.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const yml = fs.readFileSync(path.join(__dirname, '../../.github/workflows/lote-sites.yml'), 'utf8');

test('LOTE1. dispara à mão com slugs e publicar (padrão previa)', () => {
  assert.ok(/workflow_dispatch:/.test(yml));
  assert.ok(/slugs:\n\s+description:[^\n]*\n\s+required: true/.test(yml));
  assert.ok(/publicar:[\s\S]*?default: previa[\s\S]*?options: \[previa, producao\]/.test(yml));
});

test('LOTE2. 10 em paralelo, sem derrubar os outros quando um falha', () => {
  assert.ok(/fail-fast: false/.test(yml));
  assert.ok(/max-parallel: 10/.test(yml));
  assert.ok(/no máximo 10 clientes/.test(yml));
});

test('LOTE3. entradas só por variável de ambiente (nunca coladas no comando)', () => {
  const usos = yml.split('\n').filter(l => /\$\{\{\s*inputs\./.test(l));
  assert.ok(usos.length >= 2, 'o workflow usa as entradas');
  for (const l of usos) assert.ok(/^\s+[A-Z_]+: \$\{\{ inputs\.\w+ \}\}\s*$/.test(l), `entrada fora de env: ${l.trim()}`);
});

test('LOTE4. segredos listados um por um e sem ler a chave do Cloudflare em outro lugar', () => {
  assert.ok(/CLOUDFLARE_API_TOKEN: \$\{\{ secrets\.CLOUDFLARE_API_TOKEN \}\}/.test(yml));
  assert.ok(/CLOUDFLARE_ACCOUNT_ID: \$\{\{ vars\.CLOUDFLARE_ACCOUNT_ID \}\}/.test(yml));
  assert.ok(!/secrets: inherit/.test(yml));
});

test('LOTE5. etapas do plano: briefing, design, render, qualidade, prints, publicar, resumo', () => {
  for (const t of ['briefing-para-spec.js', 'clonar-site.js', 'renderizar-site.js', 'site-kit/quality', 'preview-site.js', 'pages deploy', 'lote/$DATA.json']) {
    assert.ok(yml.includes(t), `falta ${t}`);
  }
});

test('LOTE6. produção só quando pedida; prévia usa o ramo previa', () => {
  assert.ok(/if \[ "\$PUBLICAR" = "producao" \]; then RAMO=main/.test(yml));
  assert.ok(/else RAMO=previa/.test(yml));
});

test('LOTE7. os scripts que o workflow chama existem (ou são criados por outro PR já aberto)', () => {
  for (const f of ['scripts/renderizar-site.js', 'scripts/preview-site.js', 'scripts/clonar-site.js', 'nexia-ai/site-kit/quality.js']) {
    assert.ok(fs.existsSync(path.join(__dirname, '../..', f)), `falta ${f}`);
  }
});
