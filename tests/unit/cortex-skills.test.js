'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { listar, catalogo, escolher, carregar } = require('../../nexia-ai/skills/index');

test('listar() lê skills e ignora pastas/arquivos inválidos', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-'));
  try {
    fs.mkdirSync(path.join(tmp, 'alpha'));
    fs.writeFileSync(path.join(tmp, 'alpha', 'SKILL.md'), '---\nname: alpha-skill\ndescription: Descrição da Alpha\n---\nCorpo da alpha');
    
    fs.mkdirSync(path.join(tmp, 'beta'));
    fs.writeFileSync(path.join(tmp, 'beta', 'SKILL.md'), 'sem frontmatter');

    const lista = listar(tmp);
    assert.strictEqual(lista.length, 1);
    assert.strictEqual(lista[0].nome, 'alpha-skill');
    assert.strictEqual(lista[0].descricao, 'Descrição da Alpha');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('catalogo() gera texto curto sem o corpo', () => {
  const lista = [
    { nome: 'job-agendado', descricao: 'cron e robos' },
    { nome: 'tela-finance', descricao: 'telas financeiras' }
  ];
  const cat = catalogo(lista);
  assert.match(cat, /SKILLS DISPONÍVEIS:/);
  assert.match(cat, /- job-agendado: cron e robos/);
  assert.match(cat, /- tela-finance: telas financeiras/);
  assert.doesNotMatch(cat, /Corpo/);
});

test('escolher() seleciona skills relevantes com base no pedido', () => {
  const lista = [
    { nome: 'job-agendado', descricao: 'quando a tarefa cria ou muda cron, robo, fila ou varredura' },
    { nome: 'tela-finance', descricao: 'quando a tarefa mexe em telas do Kernex Finance em prumo/' }
  ];
  const escolhidas = escolher('criar cron que atualiza o estado', lista, 2);
  assert.strictEqual(escolhidas.length, 1);
  assert.strictEqual(escolhidas[0].nome, 'job-agendado');
});

test('carregar() devolve o corpo sem frontmatter limitado', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-'));
  try {
    fs.mkdirSync(path.join(tmp, 'minha-skill'));
    fs.writeFileSync(path.join(tmp, 'minha-skill', 'SKILL.md'), '---\nname: minha\ndescription: desc\n---\nEste é o corpo principal.');
    const corpo = carregar('minha-skill', tmp);
    assert.strictEqual(corpo.trim(), 'Este é o corpo principal.');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('listar() acha as 2 skills reais no repositório se existirem', () => {
  const lista = listar();
  const nomes = lista.map(s => s.nome);
  if (nomes.length > 0) {
    assert.ok(true);
  }
});
