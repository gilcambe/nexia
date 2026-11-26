const assert = require('node:assert');
const { describe, it } = require('node:test');
const path = require('node:path');
const fs = require('node:fs');
const skills = require('../../nexia-ai/skills/index');

describe('Cortex Skills', () => {
  it('deve listar skills', () => {
    const lista = skills.listar();
    assert.ok(Array.isArray(lista));
    assert.ok(lista.find(s => s.nome === 'tela-finance'));
    assert.ok(lista.find(s => s.nome === 'job-agendado'));
  });

  it('catalogo não deve conter corpo', () => {
    const lista = skills.listar();
    const texto = skills.catalogo(lista);
    assert.ok(!texto.includes('# SKILL'));
    assert.ok(texto.includes('SKILLS DISPONÍVEIS:'));
  });

  it('escolher deve retornar a skill correta', () => {
    const lista = skills.listar();
    const escolhidas = skills.escolher('criar cron que atualiza o estado', lista);
    assert.strictEqual(escolhidas[0].nome, 'job-agendado');
  });

  it('carregar deve devolver corpo sem frontmatter', () => {
    const corpo = skills.carregar('tela-finance');
    assert.ok(corpo.includes('Use esta skill quando a tarefa'));
    assert.ok(!corpo.includes('name: tela-finance'));
  });

  it('pasta inválida não deve derrubar listar', () => {
    // Cria uma pasta inválida que será ignorada pelo listar
    const dir = path.join(__dirname, '../../nexia-ai/skills/invalida');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'SKILL.md'), 'conteudo sem frontmatter');
    
    const lista = skills.listar();
    assert.ok(Array.isArray(lista));
    
    fs.unlinkSync(path.join(dir, 'SKILL.md'));
    fs.rmdirSync(dir);
  });
});
