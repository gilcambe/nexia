'use strict';
// 13/11/2026: o Cortex recebe código pronto da web (MIT/Apache conferido) no planejamento.
const test = require('node:test');
const assert = require('node:assert');
const p = require('../../nexia-ai/fabrica/prontos.json');
const { contextoBiblioteca, prontosCitados } = require('../../nexia-ai/fabrica/contexto');

test('PR1. só entra MIT, Apache, BSD ou ISC, com link do GitHub, sem repetido', () => {
  assert.ok(p.prontos.length >= 50);
  const vistos = new Set();
  for (const x of p.prontos) {
    assert.ok(['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', '0BSD', 'ISC'].includes(x.licenca), x.repo);
    assert.match(x.url, /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/);
    assert.ok(!vistos.has(x.repo.toLowerCase()), 'repetido ' + x.repo); vistos.add(x.repo.toLowerCase());
    assert.ok(p.palavras[x.categoria], 'categoria sem palavras: ' + x.categoria);
  }
  for (const r of ['getfider/fider', 'djyde/cusdis', 'n8n-io/n8n']) assert.ok(!p.prontos.some((x) => x.repo === r), r + ' não pode estar aprovado');
});

test('PR2. pedido de galeria traz peça pronta (roda no site) antes de sistema', () => {
  const r = prontosCitados('quero uma galeria de fotos no site da cliente');
  assert.ok(r.length > 0);
  assert.equal(r[0].tipo, 'peca');
  assert.ok(r.some((x) => /PhotoSwipe/i.test(x.repo)));
});

test('PR4. pedido de Pix traz o gerador de Pix e o de CPF/CNPJ primeiro (não o mais famoso da categoria)', () => {
  const r = prontosCitados('quero criar um site com pagamento pix e cadastro com cpf');
  assert.match(r[0].uso + r[1].uso, /pix/i, r.map((x) => x.repo).join(', '));
  assert.ok(r.slice(0, 4).some((x) => /cpf/i.test(x.uso)));
});

test('PR3. o Architect recebe os prontos e o aviso de custo de servidor', () => {
  const c = contextoBiblioteca('preciso criar um sistema de crm com leads para uma loja');
  assert.match(c, /Código PRONTO da web/);
  assert.match(c, /krayin\/laravel-crm/i);
  assert.match(c, /precisa de servidor próprio \(custo\)/);
  assert.equal(contextoBiblioteca('qual o status do deploy?'), '', 'pedido que não é sistema novo não recebe nada');
});
