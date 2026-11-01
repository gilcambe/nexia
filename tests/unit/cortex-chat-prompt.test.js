'use strict';

import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const CONTEUDO = readFileSync(
  new URL('../../netlify/functions/cortex-chat.js', import.meta.url),
  'utf8'
);

test('prompt do cortex-chat não contém "IA Suprema", "NEXIA OS" ou "SEMPRE em português"', () => {
  assert.strictEqual(CONTEUDO.includes('IA Suprema'), false);
  assert.strictEqual(CONTEUDO.includes('NEXIA OS'), false);
  assert.strictEqual(CONTEUDO.includes('SEMPRE em português'), false);
});

test('prompt do cortex-chat contém "Você é o Cortex"', () => {
  assert.strictEqual(CONTEUDO.includes('Você é o Cortex'), true);
});
