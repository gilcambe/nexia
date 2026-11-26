import test from 'node:test';
import assert from 'node:assert';
import { listar, catalogo, escolher, carregar } from '../../nexia-ai/skills/index.js';

test('cortex-skills: listar acha as 2 skills e ignora invalidas', () => {
  const skills = listar();
  assert.ok(skills.some(s => s.nome === 'tela-finance'), 'Achou tela-finance');
  assert.ok(skills.some(s => s.nome === 'job-agendado'), 'Achou job-agendado');
  assert.strictEqual(skills.length, 2, 'Apenas as 2 skills');
});

test('cortex-skills: catalogo nao contem o corpo', () => {
  const skills = listar();
  const cat = catalogo(skills);
  assert.ok(cat.includes('SKILLS DISPONÍVEIS:'));
  assert.ok(cat.includes('- tela-finance:'));
  assert.ok(!cat.includes('Regras de uso:'), 'Corpo nao esta no catalogo');
});

test('cortex-skills: escolher seleciona job-agendado', () => {
  const skills = listar();
  const escolhidas = escolher('criar cron que atualiza o estado', skills);
  assert.strictEqual(escolhidas[0].nome, 'job-agendado');
});

test('cortex-skills: carregar devolve o corpo sem frontmatter', () => {
  const corpo = carregar('tela-finance');
  assert.ok(!corpo.includes('---'), 'Frontmatter removido');
  assert.ok(corpo.includes('Regras de uso:'), 'Corpo carregado');
});
