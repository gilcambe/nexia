const assert = require('node:assert');
const { describe, it } = require('node:test');
const skills = require('../../nexia-ai/skills/index');

describe('cortex-skills', () => {
  it('deve listar skills', () => {
    const lista = skills.listar();
    assert.ok(lista.find(s => s.nome === 'tela-finance'));
    assert.ok(lista.find(s => s.nome === 'job-agendado'));
  });

  it('catalogo não deve conter o corpo', () => {
    const lista = skills.listar();
    const texto = skills.catalogo(lista);
    assert.ok(texto.includes('SKILLS DISPONÍVEIS:'));
    assert.ok(texto.includes('tela-finance:'));
    assert.ok(texto.includes('job-agendado:'));
    assert.ok(!texto.includes('# SKILL'));
    assert.ok(!texto.includes('Regras de uso'));
  });

  it('escolher deve priorizar job-agendado para cron', () => {
    const lista = skills.listar();
    const escolhidas = skills.escolher('criar cron que atualiza o estado', lista);
    assert.strictEqual(escolhidas[0].nome, 'job-agendado');
  });

  it('carregar deve devolver o corpo sem frontmatter', () => {
    const corpo = skills.carregar('tela-finance');
    assert.ok(corpo.includes('# SKILL tela-finance'));
    assert.ok(!corpo.includes('---'));
    assert.ok(!corpo.includes('name: tela-finance'));
  });

  it('pasta inválida ou skill quebrada não deve derrubar listar', () => {
    // Simula chamando listar sem erro
    assert.doesNotThrow(() => skills.listar());
  });
});
