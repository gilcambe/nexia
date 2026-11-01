'use strict';
// #823 (Melhoria C5): perguntas são respondidas na hora; só pedido de código vira issue.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ts = require('typescript');
const DIR = path.join(__dirname, '..', '..', 'src', 'pages', 'cortex');

async function carregar() {
  const out = ts.transpileModule(fs.readFileSync(path.join(DIR, 'intencao.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ES2022, target: 'ES2022' } }).outputText;
  const arq = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'c5-')), 'm.mjs');
  fs.writeFileSync(arq, out);
  return import(arq);
}

test('C5a. perguntas viram resposta direta; pedidos de mudança continuam virando tarefa', async () => {
  const { ehPergunta } = await carregar();
  for (const p of ['como estamos?', 'O que falta?', 'quantas tarefas estão travadas', 'Qual modelo grátis é o mais rápido?', 'status']) assert.equal(ehPergunta(p), true, p);
  for (const p of ['Crie a tela de login', 'pode corrigir o botão do Body Coach?', 'Mude o texto da Central', 'adicionar ícone no app', '']) assert.equal(ehPergunta(p), false, p);
  assert.equal(ehPergunta('como faço?\n\n```js\nx()\n```'), false, 'texto com código vira pedido');
});

test('C5b. pergunta sobre a situação lê a Central e monta contexto com números reais', async () => {
  const { ehSobreSituacao, contextoCentral } = await carregar();
  assert.equal(ehSobreSituacao('como estamos?'), true);
  assert.equal(ehSobreSituacao('o que falta?'), true);
  assert.equal(ehSobreSituacao('qual a capital da França?'), false);
  const t = contextoCentral({ naFila: 4, fazendo: [{ numero: 9, titulo: 'Tela X' }], travadas: [], feitas7: 12, proximas: [] });
  assert.match(t, /na fila: 4/);
  assert.match(t, /#9 Tela X/);
  assert.match(t, /feitas nos últimos 7 dias: 12/);
  assert.equal(contextoCentral(null), '');
});

test('C5c. "Pedir tarefa" manda pergunta para "Perguntar agora"; "Virar pedido" força a tarefa', () => {
  const page = fs.readFileSync(path.join(DIR, 'page.tsx'), 'utf8');
  assert.match(page, /!forcarPedido && !ehPedidoDeCodigo\(texto\)/);
  assert.match(page, /setForcarPedido\(true\)/);
  const perg = fs.readFileSync(path.join(DIR, 'Pergunta.tsx'), 'utf8');
  assert.match(perg, /\?parte=cortex/);
  assert.match(perg, /primeira/);
});

test('C5d. ehPedidoDeCodigo detecta corretamente textos com palavras de código', async () => {
  const { ehPedidoDeCodigo } = await carregar();
  // Testes com palavras relacionadas a alterações de projeto/sistema
  assert.equal(ehPedidoDeCodigo('criar uma nova tela de login'), true);
  assert.equal(ehPedidoDeCodigo('corrigir bug no app'), true);
  assert.equal(ehPedidoDeCodigo('mudar o botão do site'), true);
  assert.equal(ehPedidoDeCodigo('deploy no repositório'), true);
  assert.equal(ehPedidoDeCodigo('publicar nova versão'), true);
  assert.equal(ehPedidoDeCodigo('issue no painel'), true);
  assert.equal(ehPedidoDeCodigo('criar PR para o tenant'), true);
  assert.equal(ehPedidoDeCodigo('ajustar Body Coach'), true);
  assert.equal(ehPedidoDeCodigo('configurar Splash'), true);
  assert.equal(ehPedidoDeCodigo('atualizar Central'), true);
  assert.equal(ehPedidoDeCodigo('código com erro'), true);
  assert.equal(ehPedidoDeCodigo('repositório git'), true);
  
  // Testes com textos que não são pedidos de código
  assert.equal(ehPedidoDeCodigo('qual o clima hoje?'), false);
  assert.equal(ehPedidoDeCodigo('como estão as coisas?'), false);
  assert.equal(ehPedidoDeCodigo('quantas tarefas existem?'), false);
  assert.equal(ehPedidoDeCodigo('o que é uma API?'), false);
  assert.equal(ehPedidoDeCodigo(''), false);
  assert.equal(ehPedidoDeCodigo(' '), false);
  assert.equal(ehPedidoDeCodigo('texto sem palavras relacionadas'), false);
});
