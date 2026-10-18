'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { acharProjeto, montarPedido } = require('../../netlify/functions/central/pedidos-pedir.js');

test('PPD1. o texto livre acha o projeto certo', () => {
  assert.strictEqual(acharProjeto('Mudar a cor do botão de treino no Body Coach').id, 'body-coach');
  assert.strictEqual(acharProjeto('Botão de WhatsApp no site da Carol').id, 'studiolima');
  assert.strictEqual(acharProjeto('Fazer o Cortex avisar quando terminar').id, 'cortex');
  assert.strictEqual(acharProjeto('Postar mais no Instagram').id, 'divulga');
  assert.strictEqual(acharProjeto('Qualquer coisa solta'), null);
});

test('PPD2. o pedido sai com projeto, pastas, rótulo e regras', () => {
  const p = montarPedido('Na dieta do Body Coach, mostrar as calorias do dia', 'dono@nexia');
  assert.deepStrictEqual(p.labels, ['cortex-fila', 'projeto-body-coach']);
  assert.ok(p.body.includes('apps/body-coach/src/') && p.body.includes('tudo grátis') && p.body.includes('dono@nexia'));
});

test('PPD3. sem projeto, manda descobrir', () => {
  const p = montarPedido('Trocar a fonte do título', 'dono');
  assert.deepStrictEqual(p.labels, ['cortex-fila']);
  assert.ok(p.body.includes('Projeto não indicado'));
});
