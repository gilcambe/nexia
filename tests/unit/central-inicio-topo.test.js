'use strict';
// Central (#1869): abertura "Olá", atalhos dos módulos e números reais (sem número inventado).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const fonte = fs.readFileSync(path.join(__dirname, '..', '..', 'src/pages/central/Inicio.tsx'), 'utf8');

test('CENTRAL-INICIO: saudação, atalhos, grade larga e "sem dado ainda"', () => {
  for (const t of ['Olá, Gil', 'sem dado ainda', 'lg:grid-cols-3', 'lg:grid-cols-5', 'Estado dos serviços', 'das tarefas da semana prontas']) assert.ok(fonte.includes(t), t);
});

test('CENTRAL-INICIO: nenhum número fixo inventado no JSX', () => {
  assert.doesNotMatch(fonte, />\s*\d+(\.\d+)?\s*[MK%]?\s*</);
  assert.doesNotMatch(fonte, /2\.4M|US\$/);
});
