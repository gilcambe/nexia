'use strict';
// 17/11/2026: a #3885 (menu do Finance) entrou com "const btn" declarado 2 vezes em prumo/app.js. Os testes só liam o
// texto do arquivo e nenhum rodava o código: o site ficou fora do ar (SyntaxError, o app não abria). Agora todo .js do
// app do navegador precisa compilar.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const pasta = path.join(__dirname, '../../prumo');
const arquivos = fs.readdirSync(pasta).filter((f) => f.endsWith('.js'));

test('todo prumo/*.js compila (sem erro de sintaxe)', () => {
  assert.ok(arquivos.length > 10);
  for (const f of arquivos) {
    const codigo = fs.readFileSync(path.join(pasta, f), 'utf8');
    assert.doesNotThrow(() => new vm.Script(codigo, { filename: f }), `prumo/${f} tem erro de sintaxe`);
  }
});

test('scripts dentro do index.html também compilam', () => {
  const html = fs.readFileSync(path.join(pasta, 'index.html'), 'utf8');
  const blocos = [...html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type="(?:module|application\/ld\+json)")[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  for (const b of blocos) assert.doesNotThrow(() => new vm.Script(b), 'script do index.html com erro de sintaxe');
});
