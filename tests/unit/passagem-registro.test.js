'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { lerRegistro, escreverRegistro, itensPendentes } = require('../../nexia-ai/passagem/registro.js');

test('registro: lerRegistro extrai objeto JSON válido do marcador', () => {
  const corpo = `
# Thread em andamento
Fazendo ajustes de latência.

<!-- trabalho:{"quem":"claude","onde":"thread Corrigir delay","repo":"gilcambe/avaya-gsd","ramo":"claude/xyz","sinal":"2026-11-09T01:07:59Z","itens":[{"t":"Cortar espera","feito":false,"arquivos":["app/speech.js"]}],"estado":"trabalhando"} -->
Fim da issue.
  `;
  const reg = lerRegistro(corpo);
  assert.ok(reg);
  assert.equal(reg.quem, 'claude');
  assert.equal(reg.repo, 'gilcambe/avaya-gsd');
  assert.equal(reg.itens.length, 1);
  assert.equal(reg.itens[0].feito, false);
});

test('registro: lerRegistro retorna null se não houver marcador ou se for JSON corrompido', () => {
  assert.equal(lerRegistro('texto sem marcador'), null);
  assert.equal(lerRegistro('<!-- trabalho:{invalido} -->'), null);
});

test('registro: escreverRegistro substitui apenas o bloco existente preservando texto ao redor', () => {
  const corpoOriginal = 'Inicio\n<!-- trabalho:{"estado":"trabalhando"} -->\nFim';
  const novo = { estado: 'passado', quem: 'claude' };
  const atualizado = escreverRegistro(corpoOriginal, novo);
  assert.match(atualizado, /^Inicio\n<!-- trabalho:\{"estado":"passado","quem":"claude"\} -->\nFim$/);
});

test('registro: escreverRegistro adiciona bloco se não existir no corpo', () => {
  const corpo = 'Apenas descrição da tarefa';
  const reg = { estado: 'trabalhando' };
  const atualizado = escreverRegistro(corpo, reg);
  assert.match(atualizado, /Apenas descrição da tarefa\n\n<!-- trabalho:\{"estado":"trabalhando"\} -->/);
});

test('registro: itensPendentes filtra itens com feito === false mantendo índice original', () => {
  const reg = {
    itens: [
      { t: 'Item 0 já feito', feito: true },
      { t: 'Item 1 pendente', feito: false, arquivos: ['a.js'] },
      { t: 'Item 2 pendente', feito: false }
    ]
  };
  const pendentes = itensPendentes(reg);
  assert.equal(pendentes.length, 2);
  assert.equal(pendentes[0].indice, 1);
  assert.equal(pendentes[0].t, 'Item 1 pendente');
  assert.equal(pendentes[1].indice, 2);
});
