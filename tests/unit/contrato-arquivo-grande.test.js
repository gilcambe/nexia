'use strict';
// Melhoria 28 do Cortex: arquivo grande vai em trechos (começo + definições citadas no pedido/teste), não cortado nos
// 20 mil primeiros caracteres. Caso real: #3935 (prumo.js 38 KB; viaLista fica depois dos 20 mil; 12 IAs falharam).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { trechosRelevantes, montarPedido } = require('../../nexia-ai/contrato/executor');

function grande() {
  const enche = Array.from({ length: 900 }, (_, i) => `const lixo${i} = ${i}; // ${'x'.repeat(20)}`).join('\n');
  return `'use strict';\nconst TOPO = 1;\n${enche}\nasync function viaLista(lista, img) {\n  return lista[0];\n}\n${enche.replace(/lixo/g, 'resto')}\nfunction outraCoisa() { return 2; }\n`;
}

test('arquivo pequeno vai inteiro', () => {
  const r = trechosRelevantes('const a = 1;\n', 'qualquer');
  assert.equal(r.grande, false);
  assert.equal(r.texto, 'const a = 1;\n');
});

test('arquivo grande: mostra o começo e a função citada mesmo depois dos 20 mil caracteres', () => {
  const txt = grande();
  assert.ok(txt.length > 40000 && txt.indexOf('viaLista') > 20000);
  const r = trechosRelevantes(txt, 'O teste chama viaLista com 3 IAs.');
  assert.equal(r.grande, true);
  assert.match(r.texto, /^'use strict';\nconst TOPO = 1;/);
  assert.match(r.texto, /async function viaLista\(lista, img\) \{\n  return lista\[0\];\n\}/, 'função inteira, exata para SEARCH');
  assert.doesNotMatch(r.texto, /function outraCoisa/, 'função não citada fica de fora');
  assert.match(r.texto, /omitida/);
  assert.ok(r.texto.length < 30000);
});

test('montarPedido: arquivo grande diz para usar SEARCH/REPLACE e traz o trecho citado no teste', () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'ctr28-'));
  fs.mkdirSync(path.join(raiz, 'src')); fs.mkdirSync(path.join(raiz, 'tests'));
  fs.writeFileSync(path.join(raiz, 'src/grande.js'), grande());
  fs.writeFileSync(path.join(raiz, 'tests/t.test.js'), "require('../src/grande').viaLista");
  const c = { pedido: 'Deixe mais rápido.', arquivos: ['src/grande.js'], testes: ['tests/t.test.js'], teste: 'node --test tests/t.test.js' };
  const p = montarPedido(c, raiz, '');
  assert.match(p, /ARQUIVO src\/grande\.js \(GRANDE/);
  assert.match(p, /SEARCH\/REPLACE/);
  assert.match(p, /async function viaLista/);
  fs.rmSync(raiz, { recursive: true, force: true });
});

test('caso real #3935: prumo.js em trechos traz viaLista', () => {
  const f = path.join(__dirname, '../../netlify/functions/prumo.js');
  const txt = fs.readFileSync(f, 'utf8');
  if (!/function viaLista/.test(txt)) return; // o arquivo mudou de forma; o caso sintético acima continua valendo
  const r = trechosRelevantes(txt, 'viaLista bate esperaCorridaMs');
  assert.match(r.texto, /function viaLista/);
});
