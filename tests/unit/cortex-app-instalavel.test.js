'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const ler = (p) => fs.readFileSync(path.join(__dirname, '../..', p), 'utf8');

test('CXAPP1. Cortex instalável de verdade: service worker registrado, sem frases de início, anexos de qualquer tipo', () => {
  assert.match(ler('public/cortex-sw.js'), /addEventListener\("fetch"/);
  assert.match(ler('src/pages/cortex/page.tsx'), /register\("\/cortex-sw\.js", \{ scope: "\/cortex" \}\)/);
  assert.doesNotMatch(ler('src/pages/cortex/page.tsx'), /O que o Cortex faz hoje|SUGESTOES/);
  assert.doesNotMatch(ler('src/pages/cortex/Composer.tsx'), /só arquivos de texto ou código/);
  assert.match(ler('src/pages/cortex/Composer.tsx'), /reduzirImagem/);
  assert.match(ler('src/pages/cortex/Conversa.tsx'), /limpo\(c\.texto\)/);
});
