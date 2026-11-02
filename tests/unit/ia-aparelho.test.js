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

test('IAA5. versão do WebLLM conhece Qwen2.5; celular sem shader-f16 usa q4f32; erro aparece com motivo', () => {
  const v = /web-llm@0\.2\.(\d+)/.exec(A.WEBLLM_URL);
  assert.ok(v && Number(v[1]) >= 61, 'Qwen2.5 só existe a partir da 0.2.61');
  assert.equal(A.modeloParaGpu(A.MODELOS.leve, false), 'Qwen2.5-0.5B-Instruct-q4f32_1-MLC');
  assert.equal(A.modeloParaGpu(A.MODELOS.leve, true), A.MODELOS.leve);
  assert.match(A.motivoErro(new Error('Cannot find model record in appConfig for X')), /modelo não encontrado/);
  assert.match(A.motivoErro(new Error('Failed to fetch')), /internet/);
  assert.match(R('src/pages/cortex/Pergunta.tsx'), /motivoErro\(e\)/);
});

test('IAA6. antes de baixar testa os 2 sites e diz qual falhou', async () => {
  const reg = { model_id: 'x', model: 'https://huggingface.co/mlc-ai/x', model_lib: 'https://raw.githubusercontent.com/a/x.wasm' };
  const vistos = [];
  const ok = async (u) => { vistos.push(u); return { ok: true, status: 200 }; };
  assert.equal(await A.testarSites(reg, ok), null);
  assert.equal(vistos[0], 'https://huggingface.co/mlc-ai/x/resolve/main/mlc-chat-config.json');
  assert.match(await A.testarSites(reg, async () => { throw new TypeError('Failed to fetch'); }), /huggingface\.co/);
  assert.match(await A.testarSites(reg, async (u) => (u.endsWith('.wasm') ? { ok: false, status: 404 } : { ok: true })), /raw\.githubusercontent\.com respondeu erro 404/);
  assert.match(A.motivoErro(new Error('o aparelho não conseguiu abrir huggingface.co (onde fica a IA)')), /^o aparelho não conseguiu abrir huggingface/);
  assert.match(R('src/lib/ia-aparelho.ts'), /useIndexedDBCache: true/);
});
