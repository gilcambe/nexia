'use strict';
// Central (#1003, #1004): clientes antigos na lista e textos visíveis com a marca Kernex.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const raiz = path.join(__dirname, '..', '..');
const { PRODUTOS, NO_AR, LINKS } = require('../../central/produtos');

test('CENTRAL-CLIENTES: lista tem CES, Viajante Pro, Splash, Adriano e Arqia sem tirar ninguém', () => {
  const ids = PRODUTOS.map((p) => p.id);
  for (const id of ['body-coach', 'cortex', 'achados', 'divulga', 'bezsan', 'studiolima', 'ces', 'vp', 'splash', 'adriano', 'arqia']) assert.ok(ids.includes(id), id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(!ids.includes('ev') && !ids.includes('mycoach'));
  for (const id of ['adriano', 'arqia']) {
    const p = PRODUTOS.find((x) => x.id === id);
    assert.equal(p.pendente, true);
    assert.ok(!NO_AR.includes(p), `${id} não é medido`);
  }
  assert.ok(NO_AR.every((p) => /^https:\/\//.test(p.site)));
  assert.match(fs.readFileSync(path.join(raiz, 'src/pages/central/Produtos.tsx'), 'utf8'), /em breve/i);
});

test('CENTRAL-KERNEX: nenhum texto entre aspas exibido nas telas da Central diz NEXIA', () => {
  const dir = path.join(raiz, 'src/pages/central');
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.tsx'))) {
    const linhas = fs.readFileSync(path.join(dir, f), 'utf8').split('\n')
      .filter((l) => !/^\s*(\/\/|import )/.test(l))
      .map((l) => l.replace(/https?:\/\/\S+/g, '').replace(/\bnexia[-_][\w-]*/g, '').replace(/\{\/\*.*?\*\/\}/g, ''));
    for (const l of linhas) {
      assert.doesNotMatch(l, /"[^"]*\bNEXIA\b[^"]*"|>[^<{]*\bNEXIA\b[^<{]*</, `${f}: ${l.trim()}`);
    }
  }
  assert.ok(LINKS.some((l) => l.nome === 'Gmail da Kernex'));
  assert.ok(!PRODUTOS.concat(LINKS).some((p) => /NEXIA/.test(`${p.nome} ${p.frase || ''}`)));
});
