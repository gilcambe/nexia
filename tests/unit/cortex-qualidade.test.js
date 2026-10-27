'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  rodarProvaQualidade,
  calcularP95,
  avaliarFallback,
  avaliarComIAJuiz
} = require('../../scripts/cortex-qualidade');

const PERGUNTAS_PATH = path.join(__dirname, '..', 'qualidade', 'cortex-30-perguntas.json');

test('CQ1. cortex-30-perguntas.json existe e possui exatamente 30 perguntas com estrutura válida', () => {
  assert.equal(fs.existsSync(PERGUNTAS_PATH), true, 'O arquivo cortex-30-perguntas.json deve existir');

  const dados = JSON.parse(fs.readFileSync(PERGUNTAS_PATH, 'utf8'));
  assert.equal(Array.isArray(dados), true);
  assert.equal(dados.length, 30, 'Deve conter exatamente 30 perguntas');

  const ids = new Set();
  const categorias = new Set();

  dados.forEach((p, index) => {
    assert.equal(typeof p.id, 'number', `Pergunta #${index + 1} deve ter id numérico`);
    assert.equal(typeof p.categoria, 'string', `Pergunta #${index + 1} deve ter categoria`);
    assert.ok(p.categoria.length > 0, `Categoria não pode ser vazia na pergunta #${p.id}`);
    assert.equal(typeof p.pergunta, 'string', `Pergunta #${p.id} deve ter texto`);
    assert.ok(p.pergunta.length >= 15, `Pergunta #${p.id} deve ser descritiva`);
    assert.equal(Array.isArray(p.deve_conter), true, `Pergunta #${p.id} deve ter array deve_conter`);
    assert.ok(p.deve_conter.length >= 2, `Pergunta #${p.id} deve especificar pelo menos 2 critérios em deve_conter`);

    ids.add(p.id);
    categorias.add(p.categoria);
  });

  assert.equal(ids.size, 30, 'Os IDs devem ser únicos de 1 a 30');
  assert.ok(categorias.size >= 10, 'Deve haver diversidade de temas (pelo menos 10 categorias)');
});

test('CQ2. calcularP95 calcula corretamente o 95º percentil', () => {
  assert.equal(calcularP95([]), 0);
  assert.equal(calcularP95([5]), 5);
  assert.equal(calcularP95([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), 10);

  const tempos = Array.from({ length: 100 }, (_, i) => i + 1); // 1 a 100
  assert.equal(calcularP95(tempos), 95);
});

test('CQ3. avaliarFallback atribui nota condizente com critérios atendidos', () => {
  const p = {
    id: 1,
    categoria: 'teste',
    pergunta: 'Pergunta teste',
    deve_conter: ['padaria', 'fermentação natural']
  };

  const ruim = avaliarFallback(p, 'Curto');
  assert.equal(ruim.correto, 2);

  const bom = avaliarFallback(p, 'Esta é uma resposta completa da padaria artesanal com pão de fermentação natural saboroso.');
  assert.ok(bom.correto >= 8);
  assert.equal(bom.seguro, 10);
});

test('CQ4. rodarProvaQualidade executa de ponta a ponta e retorna relatório estruturado', async () => {
  const res = await rodarProvaQualidade();

  assert.ok(typeof res.notaMedia === 'number');
  assert.ok(typeof res.respostasAbaixo5 === 'number');
  assert.ok(typeof res.p95Tempo === 'number');
  assert.ok(typeof res.aprovadoParaVenda === 'boolean');
  assert.equal(Array.isArray(res.resultados), true);
  assert.equal(res.resultados.length, 30);
  assert.ok(res.relatorioMarkdown.includes('Relatório da Prova de Qualidade Q8 do Cortex'));
});
