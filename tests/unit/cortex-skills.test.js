const assert = require('node:assert');
const { describe, it } = require('node:test');
const skills = require('../nexia-ai/skills/index.js');

describe('Cortex Skills', () => {
  it('deve listar as skills disponíveis', () => {
    const lista = skills.listar();
    assert.ok(lista.some(s => s.nome === 'tela-finance'));
    assert.ok(lista.some(s => s.nome === 'job-agendado'));
  });

  it('catálogo não deve conter o corpo das skills', () => {
    const lista = skills.listar();
    const catalogo = skills.catalogo(lista);
    assert.ok(!catalogo.includes('# SKILL tela-finance'));
    assert.ok(catalogo.includes('- tela-finance:'));
  });

  it('deve escolher a skill correta com base no pedido', () => {
    const lista = skills.listar();
    const pedido = "criar cron que atualiza o estado";
    const escolhidas = skills.escolher(pedido, lista);
    assert.ok(escolhidas.some(s => s.nome === 'job-agendado'));
    assert.ok(!escolhidas.some(s => s.nome === 'tela-finance'));
  });

  it('carregar deve devolver o corpo sem o frontmatter', () => {
    const corpo = skills.carregar('tela-finance');
    assert.ok(!corpo.includes('---'));
    assert.ok(corpo.includes('# SKILL tela-finance'));
  });
});
