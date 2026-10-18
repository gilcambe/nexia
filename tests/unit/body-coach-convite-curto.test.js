'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const lerSrc = (p) => fs.readFileSync(path.join(__dirname, '../../apps/body-coach/src', p), 'utf8');

test('BCCC1. convite curto /c/:codigo abre a mesma tela e os links gerados usam o formato curto', () => {
  assert.match(lerSrc('router/config.tsx'), /path: "\/c\/:codigo",\s*element: <Convite \/>/);
  assert.match(lerSrc('pages/coach/Convites.tsx'), /BASE_URL\}c\/\$\{/);
  assert.match(lerSrc('pages/profile/components/ConviteCoach.tsx'), /BASE_URL\}c\/\$\{/);
});
