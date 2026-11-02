'use strict';
// #2856 / #1823: "IA no meu aparelho" (WebLLM) responde pergunta curta e o resto cai para a nuvem.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const R = p => fs.readFileSync(path.join(__dirname, '..', '..', p), 'utf8');

function carregarLib() {
  const js = ts.transpileModule(R('src/lib/ia-aparelho.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', js)(mod, mod.exports, require);
  return mod.exports;
}
const A = carregarLib();
const motorFalso = (texto, demora = 0) => ({ chat: { completions: { create: async () => { if (demora) await new Promise(r => setTimeout(r, demora)); return { choices: [{ message: { content: texto } }] }; } } } });

test('IAA1. só pergunta curta e simples vai para o aparelho', () => {
  assert.equal(A.perguntaSimples('Qual a capital do Brasil?'), true);
  assert.equal(A.perguntaSimples('Qual a capital?', 'rapido'), true);
  assert.equal(A.perguntaSimples('Qual a capital?', 'pesquisar'), false);
  assert.equal(A.perguntaSimples('Qual a capital?', 'pensar'), false);
  assert.equal(A.perguntaSimples('x'.repeat(281)), false);
  assert.equal(A.perguntaSimples('veja https://site.com'), false);
  assert.equal(A.perguntaSimples('```js\ncode\n```'), false);
  assert.equal(A.perguntaSimples('   '), false);
});

test('IAA2. sem WebGPU ou com pouca memória não liga e explica o motivo', async () => {
  assert.equal((await A.suporte({})).ok, false);
  assert.match((await A.suporte({ gpu: { requestAdapter: async () => ({}) }, deviceMemory: 2 })).motivo, /memória/);
  assert.equal((await A.suporte({ gpu: { requestAdapter: async () => null } })).ok, false);
  assert.equal((await A.suporte({ gpu: { requestAdapter: async () => ({}) }, deviceMemory: 8 })).ok, true);
});

test('IAA3. responde no aparelho; sem motor, pergunta longa ou erro devolve null (vai para a nuvem)', async () => {
  assert.equal(await A.responderNoAparelho('Oi?', undefined, motorFalso('Olá!')), 'Olá!');
  assert.equal(await A.responderNoAparelho('Oi?', undefined, null), null);
  assert.equal(await A.responderNoAparelho('x'.repeat(400), undefined, motorFalso('não')), null);
  assert.equal(await A.responderNoAparelho('Oi?', undefined, { chat: { completions: { create: async () => { throw new Error('gpu'); } } } }), null);
  assert.equal(await A.responderNoAparelho('Oi?', undefined, motorFalso('   ')), null);
});

test('IAA4. tela Perguntar tem o botão, carrega a lib só quando liga, e marca a resposta "no seu aparelho"', () => {
  const p = R('src/pages/cortex/Pergunta.tsx');
  assert.match(p, /data-testid="cx-ia-aparelho"/);
  assert.match(p, /responderNoAparelho\(texto, modo\)/);
  assert.match(p, /no seu aparelho \(grátis\)/);
  const lib = R('src/lib/ia-aparelho.ts');
  assert.match(lib, /web-llm@\d+\.\d+\.\d+/, 'versão fixa do CDN');
  assert.match(lib, /import\(\/\* @vite-ignore \*\/ WEBLLM_URL\)/, 'import sob demanda');
});
