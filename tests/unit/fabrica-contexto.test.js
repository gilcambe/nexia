'use strict';
// M6 (12/11/2026): o Cortex consulta a Biblioteca antes de planejar sistema novo.
const test = require('node:test');
const assert = require('node:assert/strict');
const { contextoBiblioteca } = require('../../nexia-ai/fabrica/contexto');
const { systemPrompt } = require('../../nexia-ai/orchestrator/agents');

test('FC1. pedido de site de dentista: manda clonar o demo-agenda e lista os módulos prontos com onde estão', () => {
  const t = contextoBiblioteca('Crie um site para uma clínica de dentista com agenda online e whatsapp');
  assert.match(t, /CLONÁVEL: demo-agenda/);
  assert.match(t, /novo-projeto\.js --modelo demo-agenda/);
  for (const id of ['agenda', 'whatsapp', 'site']) assert.match(t, new RegExp(`- ${id}:`));
  assert.match(t, /SÓ o que falta/);
});

test('FC2. "quero uma landing de agência de viagens" acha o modelo de viagens', () => {
  assert.match(contextoBiblioteca('Quero uma landing nova para agência de viagens'), /demo-viagens/);
});

test('FC3. pedido que não é sistema novo não recebe nada (prompt não cresce à toa)', () => {
  assert.equal(contextoBiblioteca('Corrija o botão do rodapé da Central'), '');
  assert.equal(contextoBiblioteca(''), '');
});

test('FC4. sistema sem modelo clonável: aponta o projeto parecido e manda registrar módulo novo na Biblioteca', () => {
  const t = contextoBiblioteca('Faça um sistema de controle de gastos para família');
  assert.match(t, /financas-pessoais/);
  assert.match(t, /controle-gastos/);
  assert.match(t, /catalogo\.json/);
});

test('FC5. o texto entra no prompt do Architect como contexto', () => {
  const p = systemPrompt('architect', contextoBiblioteca('Crie um site para salão de beleza'));
  assert.match(p, /BIBLIOTECA KERNEX/);
});
