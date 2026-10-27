import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('central-avisos-claros: avisos.ts tem pelo menos 8 ocorrências de impacto:', () => {
  const conteudo = readFileSync('src/pages/central/avisos.ts', 'utf8');
  const ocorrencias = (conteudo.match(/impacto:/g) || []).length;
  assert.ok(ocorrencias >= 8, `esperado pelo menos 8 ocorrências de impacto:, encontrado ${ocorrencias}`);
});

test('central-avisos-claros: avisos.ts tem pelo menos 8 ocorrências de fazer:', () => {
  const conteudo = readFileSync('src/pages/central/avisos.ts', 'utf8');
  const ocorrencias = (conteudo.match(/fazer:/g) || []).length;
  assert.ok(ocorrencias >= 8, `esperado pelo menos 8 ocorrências de fazer:, encontrado ${ocorrencias}`);
});

test('central-avisos-claros: Inicio.tsx contém a string "O que fazer"', () => {
  const conteudo = readFileSync('src/pages/central/Inicio.tsx', 'utf8');
  assert.ok(conteudo.includes('O que fazer'), 'Inicio.tsx não contém a string "O que fazer"');
});
