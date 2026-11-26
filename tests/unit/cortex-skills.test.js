import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { listar, catalogo, escolher, carregar } from '../../nexia-ai/skills/index.js';

// Setup: garantir que existem as pastas e arquivos de teste
const skillsDir = path.join(process.cwd(), 'nexia-ai/skills');
if (!fs.existsSync(skillsDir)) fs.mkdirSync(skillsDir, { recursive: true });

const testSkills = [
  { path: 'tela-finance', content: '---\nname: tela-finance\ndescription: quando a tarefa mexe em telas do Kernex Finance em prumo/\n---\ncorpo finance' },
  { path: 'job-agendado', content: '---\nname: job-agendado\ndescription: quando a tarefa cria ou muda cron, robô, fila ou varredura\n---\ncorpo job' },
  { path: 'quebrada', content: 'sem frontmatter' }
];

testSkills.forEach(s => {
  const dir = path.join(skillsDir, s.path);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, 'SKILL.md'), s.content);
});

test('testa habilidades (skills)', async (t) => {
  await t.test('listar deve achar as 2 skills validas', () => {
    const lista = listar();
    assert.strictEqual(lista.length, 2);
    assert.ok(lista.find(s => s.nome === 'tela-finance'));
    assert.ok(lista.find(s => s.nome === 'job-agendado'));
  });

  await t.test('listar ignora pasta sem SKILL.md ou com frontmatter invalido', () => {
    const lista = listar();
    assert.ok(!lista.find(s => s.nome === 'quebrada'));
  });

  await t.test('catalogo nao deve conter o corpo', () => {
    const lista = listar();
    const cat = catalogo(lista);
    assert.ok(cat.includes('SKILLS DISPONÍVEIS:'));
    assert.ok(!cat.includes('corpo finance'));
    assert.ok(!cat.includes('corpo job'));
  });

  await t.test('escolher deve selecionar job-agendado para cron', () => {
    const lista = listar();
    const escolhidas = escolher('criar cron que atualiza o estado', lista);
    assert.strictEqual(escolhidas.length, 1);
    assert.strictEqual(escolhidas[0].nome, 'job-agendado');
  });

  await t.test('escolher deve selecionar tela-finance para tela', () => {
    const lista = listar();
    const escolhidas = escolher('mexe em telas do finance', lista);
    assert.strictEqual(escolhidas.length, 1);
    assert.strictEqual(escolhidas[0].nome, 'tela-finance');
  });

  await t.test('carregar devolve o corpo sem frontmatter', () => {
    const corpo = carregar('tela-finance');
    assert.strictEqual(corpo.trim(), 'corpo finance');
  });
});
