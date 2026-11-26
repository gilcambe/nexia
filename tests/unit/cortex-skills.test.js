import { test, describe, mock } from 'node:test';
import assert from 'node:assert';
import * as skills from '../../nexia-ai/skills/index.js';
import fs from 'node:fs';
import path from 'node:path';

test('cortex-skills: listar e carregar', async () => {
  const lista = skills.listar();
  const nomes = lista.map(s => s.nome);
  assert.ok(nomes.includes('tela-finance'));
  assert.ok(nomes.includes('job-agendado'));

  const catalogo = skills.catalogo(lista);
  assert.ok(catalogo.includes('SKILLS DISPONÍVEIS:'));
  assert.ok(catalogo.includes('- tela-finance:'));
  assert.ok(!catalogo.includes('# SKILL tela-finance')); // Conteúdo completo não deve aparecer

  const corpo = skills.carregar('tela-finance');
  assert.ok(corpo.includes('Use esta skill quando a tarefa mexe em telas'));
  assert.ok(!corpo.includes('name: tela-finance'));
});

test('cortex-skills: escolher por pedido', async () => {
  const lista = skills.listar();
  const escolhidas = skills.escolher('criar cron que atualiza o estado', lista);
  assert.equal(escolhidas.length, 1);
  assert.equal(escolhidas[0].nome, 'job-agendado');
});

test('cortex-skills: pasta inválida não derruba listar', async () => {
  // Simular pasta inválida na lista
  const mockPath = path.join(process.cwd(), 'nexia-ai/skills/invalida');
  if (!fs.existsSync(mockPath)) fs.mkdirSync(mockPath, { recursive: true });
  fs.writeFileSync(path.join(mockPath, 'SKILL.md'), 'quebrado');
  
  assert.doesNotThrow(() => skills.listar());
  
  fs.rmSync(mockPath, { recursive: true });
});
