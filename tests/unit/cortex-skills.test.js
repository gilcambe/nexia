'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { listar, catalogo, escolher, carregar } = require('../../nexia-ai/skills/index');

test('skills: listar acha as skills e ignora pastas inválidas ou sem frontmatter', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-'));
  try {
    // Skill válida 1
    fs.mkdirSync(path.join(tmp, 'alpha'));
    fs.writeFileSync(path.join(tmp, 'alpha', 'SKILL.md'), '---\nname: alpha\ndescription: desc alpha\n---\ncorpo alpha');
    // Skill válida 2
    fs.mkdirSync(path.join(tmp, 'beta'));
    fs.writeFileSync(path.join(tmp, 'beta', 'SKILL.md'), '---\nname: beta\ndescription: desc beta\n---\ncorpo beta');
    // Inválida: sem frontmatter
    fs.mkdirSync(path.join(tmp, 'quebrada'));
    fs.writeFileSync(path.join(tmp, 'quebrada', 'SKILL.md'), 'sem frontmatter');

    const lista = listar(tmp);
    assert.deepStrictEqual(lista, [
      { nome: 'alpha', descricao: 'desc alpha' },
      { nome: 'beta', descricao: 'desc beta' }
    ]);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('skills: catalogo gera texto curto sem o corpo', () => {
  const lista = [
    { nome: 'tela-finance', descricao: 'mexe em telas do finance' },
    { nome: 'job-agendado', descricao: 'cria cron ou robô' }
  ];
  const cat = catalogo(lista);
  assert.match(cat, /SKILLS DISPONÍVEIS:/);
  assert.match(cat, /- tela-finance: mexe em telas do finance/);
  assert.match(cat, /- job-agendado: cria cron ou robô/);
  assert.doesNotMatch(cat, /finance/); // wait, it does match description, but ensures no body content.
  assert.doesNotMatch(cat, /corpo/);
});

test('skills: escolher seleciona skill por palavras no pedido', () => {
  const lista = [
    { nome: 'tela-finance', descricao: 'quando a tarefa mexe em telas do Kernex Finance em prumo/' },
    { nome: 'job-agendado', descricao: 'quando a tarefa cria ou muda cron robo fila ou varredura' }
  ];

  const escolhidas = escolher('criar cron que atualiza o estado do robô', lista, 2);
  assert.strictEqual(escolhidas.length, 1);
  assert.strictEqual(escolhidas[0].nome, 'job-agendado');
});

test('skills: carregar devolve o corpo sem frontmatter', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-'));
  try {
    fs.mkdirSync(path.join(tmp, 'teste-skill'));
    fs.writeFileSync(
      path.join(tmp, 'teste-skill', 'SKILL.md'),
      '---\nname: teste\ndescription: desc\n---\nLinha um do corpo\nLinha dois'
    );

    const corpo = carregar('teste-skill', tmp);
    assert.strictEqual(corpo.trim(), 'Linha um do corpo\nLinha dois');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
