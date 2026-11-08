'use strict';
// #3219 partes 1-3: Central nova (casca, Início, Tarefas).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const { pathToFileURL } = require('node:url');
const PASTA = path.join(__dirname, '../../src/pages/central/kernex');

async function regras() {
  const out = ts.transpileModule(fs.readFileSync(path.join(PASTA, 'regras.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kx-'));
  fs.writeFileSync(path.join(dir, 'regras.mjs'), out);
  return import(pathToFileURL(path.join(dir, 'regras.mjs')).href);
}

test('KX1. menu tem as 10 telas do Plano-Mestre', async () => {
  const { TELAS } = await regras();
  assert.deepEqual(TELAS.map((t) => t.nome), ['Início', 'Projetos', 'Máquinas', 'IA & Cortex', 'Tarefas', 'Arquivos', 'Publicações', 'Cofre', 'Relatórios', 'Configurações']);
  assert.ok(TELAS.every((t) => t.serve.length > 10));
});

test('KX2. tela vem da URL; inválida cai no Início', async () => {
  const { telaDaUrl } = await regras();
  assert.equal(telaDaUrl('?nova=1&tela=tarefas'), 'tarefas');
  assert.equal(telaDaUrl('?tela=xyz'), 'inicio');
});

test('KX3. semáforo: vermelho, amarelo, verde', async () => {
  const { corSemaforo } = await regras();
  assert.equal(corSemaforo({ precisa: 1 }).cor, 'vermelho');
  assert.equal(corSemaforo({ servicosFora: 1 }).cor, 'vermelho');
  assert.equal(corSemaforo({ travadas: 2 }).cor, 'amarelo');
  assert.equal(corSemaforo({}).texto, 'Tudo certo');
});

test('KX4. casca sem rolagem e Bloco mostra "sem dados" sem fonte', () => {
  const css = fs.readFileSync(path.join(PASTA, 'tema.ts'), 'utf8');
  assert.match(css, /height:100vh;overflow:hidden/);
  const bloco = fs.readFileSync(path.join(PASTA, 'Bloco.tsx'), 'utf8');
  assert.match(bloco, /sem dados/);
});

test('KX5. auditor: todo Bloco tem fonte e hora; nada de status fixo', () => {
  for (const f of fs.readdirSync(PASTA).filter((x) => x.endsWith('.tsx'))) {
    const src = fs.readFileSync(path.join(PASTA, f), 'utf8');
    for (const m of src.matchAll(/<Bloco\b[^>]*>/g)) {
      assert.match(m[0], /fonte=/, `${f}: Bloco sem fonte`);
      assert.match(m[0], /atualizadoEm=/, `${f}: Bloco sem atualizadoEm`);
    }
    assert.doesNotMatch(src, /Operacional|Resolvendo sozinho|ilimitad/i, f);
    assert.doesNotMatch(src, />\s*\d+%\s*</, `${f}: porcentagem fixa`);
  }
});
