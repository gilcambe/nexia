'use strict';

import { strict as assert } from 'node:test';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const CONTEUDO = readFileSync(
  new URL('../../netlify/functions/cortex-chat.js', import.meta.url),
  'utf8'
);

test('prompt não contém strings proibidas', () => {
  assert.ok(!CONTEUDO.includes('IA Suprema'));
  assert.ok(!CONTEUDO.includes('NEXIA OS'));
  assert.ok(!CONTEUDO.includes('SEMPRE em português'));
});

test('prompt contém "Você é o Cortex"', () => {
  assert.ok(CONTEUDO.includes('Você é o Cortex'));
});
