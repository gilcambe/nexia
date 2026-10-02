'use strict';
// Fase 4: normalização de texto usada pelo Project Resolver e pelo Context Engine.
const test = require('node:test');
const assert = require('node:assert');
const { normalize, tokens, containsPhrase, overlap } = require('../../nexia-ai/text');
const { combine } = require('../../nexia-ai/project-resolver');

test('normalize remove acento, caixa e pontuação', () => {
  assert.strictEqual(normalize('Clínica ALFA — Agendamento!'), 'clinica alfa agendamento');
});

test('containsPhrase casa palavras inteiras, nunca pedaços', () => {
  assert.ok(containsPhrase('No site da Clínica Alfa, aumente o botão', 'clinica alfa'));
  assert.ok(containsPhrase('o CES quer mudar', 'CES'));
  assert.ok(!containsPhrase('processo de acesso', 'ces'), '"ces" dentro de "processo"/"acesso" não conta');
  assert.ok(!containsPhrase('qualquer coisa', 'ab'), 'frases curtas demais são ignoradas');
});

test('tokens descarta palavras vazias; overlap mede fração da consulta presente no documento', () => {
  assert.deepStrictEqual(tokens('o site da Clínica'), ['clinica']);
  assert.strictEqual(overlap('botão check-in', 'Aumentar a área do botão de check-in'), 1);
  assert.strictEqual(overlap('capital da França', 'botão de check-in'), 0);
});

test('combinação "ou ruidoso" dos sinais (documentada no ADR-F4-01)', () => {
  assert.strictEqual(Math.round(combine([0.6, 0.4]) * 100) / 100, 0.76);
});
