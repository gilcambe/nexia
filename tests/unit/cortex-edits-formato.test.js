'use strict';
// 23/11: rodada das 02h — IA grátis mandou "edits" fora do formato e o Orchestrator caiu com TypeError.
const test = require('node:test');
const assert = require('node:assert');
const { writtenPaths, comoLista } = require('../../nexia-ai/orchestrator/runtime');

test('edits/files em qualquer formato não derrubam: lista, objeto, texto JSON, lixo', () => {
  assert.deepStrictEqual(writtenPaths('github.edit_files', { edits: [{ path: 'a.js' }] }), ['a.js']);
  assert.deepStrictEqual(writtenPaths('github.edit_files', { edits: { path: 'b.js', find: 'x', replace: 'y' } }), ['b.js']);
  assert.deepStrictEqual(writtenPaths('github.edit_files', { edits: { 0: { path: 'c.js' }, 1: { path: 'd.js' } } }), ['c.js', 'd.js']);
  assert.deepStrictEqual(writtenPaths('github.edit_files', { edits: '[{"path":"e.js"}]' }), ['e.js']);
  assert.deepStrictEqual(writtenPaths('github.edit_files', { edits: 'não é json' }), []);
  assert.deepStrictEqual(writtenPaths('github.commit_files', { files: 42 }), []);
  assert.deepStrictEqual(writtenPaths('github.edit_files', null), []);
  assert.deepStrictEqual(comoLista(undefined), []);
});
