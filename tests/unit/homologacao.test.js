'use strict';
// Homologação Kernex (#3265/#3266): regras do portão e do catálogo.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const h = require('../../scripts/homologacao/rodar.js');

const RAIZ = path.resolve(__dirname, '..', '..');
const PRODUTOS = ['central', 'cortex', 'kernex-finance', 'body-coach', 'viajante-pro', 'bezsan', 'studio-lima', 'sites-clientes', 'plataforma', 'gsd-lab'];

test('HM1. cada teste unitário vira um caso do produto certo', () => {
  assert.equal(h.produtoDe('prumo-carteira.test.js'), 'kernex-finance');
  assert.equal(h.produtoDe('body-coach-treino.test.js'), 'body-coach');
  assert.equal(h.produtoDe('central-kernex.test.js'), 'central');
  assert.equal(h.produtoDe('cortex-fila.test.js'), 'cortex');
  assert.equal(h.produtoDe('viajante-pro.test.js'), 'viajante-pro');
  assert.equal(h.produtoDe('qualquer.test.js'), 'plataforma');
  const auto = h.casosAutomaticos();
  assert.ok(auto.length > 100, 'todos os testes de tests/unit entram');
  assert.ok(auto.some((c) => c.teste === path.join('tests', 'unit', 'homologacao.test.js')));
});

test('HM2. status: falhou e passou na 2a = instável; falhou 2x = vermelho; falta teste obrigatório bloqueia', () => {
  assert.equal(h.statusDoCaso([{ ok: true }]), 'verde');
  assert.equal(h.statusDoCaso([{ ok: false }, { ok: true }]), 'instavel');
  assert.equal(h.statusDoCaso([{ ok: false }, { ok: false }]), 'vermelho');
  assert.equal(h.statusDoProduto([{ status: 'verde' }, { status: 'instavel' }]), 'instavel');
  assert.equal(h.statusDoProduto([{ status: 'verde' }, { status: 'vermelho' }]), 'vermelho');
  assert.equal(h.statusDoProduto([{ status: 'falta-teste' }]), 'vermelho');
  assert.equal(h.statusDoProduto([{ status: 'falta-teste', obrigatorio: false }]), 'instavel');
});

test('HM3. catálogo: id único, produto válido, todo caso obrigatório tem arquivo de teste', () => {
  const casos = h.casosDoCatalogo();
  assert.ok(casos.length >= 3);
  const ids = new Set();
  for (const c of casos) {
    assert.ok(!ids.has(c.id), 'id repetido ' + c.id); ids.add(c.id);
    assert.ok(PRODUTOS.includes(c.produto), c.id + ' produto ' + c.produto);
    assert.ok(c.titulo && c.teste, c.id + ' sem título ou teste');
    if (c.obrigatorio !== false) assert.ok(fs.existsSync(path.join(RAIZ, c.teste)), c.id + ': caso só no papel, falta ' + c.teste);
  }
  assert.ok(casos.some((c) => c.produto === 'kernex-finance' && /duplicad/i.test(c.origem)), 'bug de ativo duplicado está no catálogo');
});

test('HM4. rodada real numa pasta de teste: reprova com vermelho e aprova quando tudo passa', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'homolog-'));
  fs.mkdirSync(path.join(dir, 'tests', 'unit'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'homologacao', 'catalogo'), { recursive: true });
  const t = (n, corpo) => fs.writeFileSync(path.join(dir, 'tests', 'unit', n), `const test = require('node:test'); test('x', () => { ${corpo} });`);
  t('prumo-a.test.js', ''); t('central-b.test.js', 'throw new Error("quebrado")');
  fs.writeFileSync(path.join(dir, 'homologacao', 'catalogo', 'x.json'), JSON.stringify({ produto: 'cortex', casos: [{ id: 'CX-9', titulo: 'sem teste ainda', teste: 'tests/unit/nao-existe.test.js', obrigatorio: false }] }));
  let r = await h.rodarTudo({ raiz: dir, paralelo: 2, limiteMs: 60000 });
  assert.equal(r.aprovado, false);
  assert.equal(r.produtos.central.status, 'vermelho');
  assert.equal(r.produtos['kernex-finance'].status, 'verde');
  assert.equal(r.produtos.cortex.status, 'instavel');
  assert.match(h.resumoMd(r), /REPROVADO/);
  t('central-b.test.js', '');
  r = await h.rodarTudo({ raiz: dir, paralelo: 2, limiteMs: 60000 });
  assert.equal(r.aprovado, true);
  assert.match(h.resumoMd(r), /APROVADO/);
});
