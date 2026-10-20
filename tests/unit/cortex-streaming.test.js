// #822 Streaming real de resposta no app Cortex: o Worker manda SSE aos pedaços e o app mostra as palavras chegando.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const { pathToFileURL } = require('node:url');
const { handleRequest } = require('../../cloudflare/app');

const R = (p) => fs.readFileSync(path.join(__dirname, '..', '..', p), 'utf8');

async function carregarSSE() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cx-sse-'));
  const out = ts.transpileModule(R('src/lib/sse.ts'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  fs.writeFileSync(path.join(dir, 'sse.mjs'), out);
  return import(pathToFileURL(path.join(dir, 'sse.mjs')).href);
}

test('SSE1. leitor junta linhas cortadas entre pedaços de rede e entende JSON, texto e [DONE]', async () => {
  const { criarLeitorSSE } = await carregarSSE();
  const l = criarLeitorSSE();
  assert.deepEqual(l.empurrar('data: {"tok'), []);
  assert.deepEqual(l.empurrar('en":"Olá","done":false}\n\n'), [{ json: { token: 'Olá', done: false } }]);
  assert.deepEqual(l.empurrar(': comentário\r\nevent: x\r\ndata:{"token":" mundo"}\r\n\r\n'), [{ json: { token: ' mundo' } }]);
  assert.deepEqual(l.empurrar('data: texto puro\n'), [{ texto: 'texto puro' }]);
  assert.deepEqual(l.empurrar('data: [DONE]'), []);
  assert.deepEqual(l.terminar(), [{ fim: true }], 'última linha sem \\n também conta');
  assert.deepEqual(l.terminar(), []);
});

test('SSE2. o Worker entrega cada pedaço do handler assim que sai (sem esperar o fim)', async () => {
  let liberar;
  const segundo = new Promise((r) => { liberar = r; });
  async function* eventos() {
    yield 'data: {"token":"Oi","done":false}\n\n';
    await segundo;
    yield 'data: {"done":true}\n\ndata: [DONE]\n\n';
  }
  const fn = { handler: async () => ({ statusCode: 200, headers: { 'Content-Type': 'text/event-stream' }, stream: eventos() }) };
  const res = await handleRequest(new Request('https://nexia.test/api/cortex', { method: 'POST', body: '{}' }), { ASSETS: { fetch: async () => new Response('', { status: 404 }) } }, { getFunction: (n) => (n === 'cortex-chat' ? fn : null) });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('Content-Type'), /text\/event-stream/);
  assert.equal(res.headers.get('X-Accel-Buffering'), 'no');
  const rd = res.body.getReader();
  const dec = new TextDecoder();
  const primeiro = dec.decode((await rd.read()).value);
  assert.match(primeiro, /"token":"Oi"/, 'primeira palavra chega antes do resto existir');
  liberar();
  let resto = '';
  for (let x = await rd.read(); !x.done; x = await rd.read()) resto += dec.decode(x.value);
  assert.match(resto, /\[DONE\]/);
});

test('SSE3. app Cortex: aba "Perguntar agora" usa o streaming e mostra a resposta crescendo', () => {
  const api = R('src/services/api.ts');
  assert.match(api, /criarLeitorSSE\(\)/, 'streamCortex usa o leitor testado');
  assert.match(api, /conversationId: payload\.conversationId \|\| "default"/);
  assert.match(api, /application\\\/json/, 'resposta pronta em JSON também aparece');
  const p = R('src/pages/cortex/Pergunta.tsx');
  assert.match(p, /streamCortex\(/);
  assert.match(p, /texto: x\.texto \+ c\.token/, 'cada pedaço soma ao texto já mostrado');
  assert.match(p, /abort\(\)/, 'botão Parar corta a resposta');
  assert.match(p, /virarPedido/);
  const page = R('src/pages/cortex/page.tsx');
  assert.match(page, /Perguntar agora/);
  assert.match(page, /<Pergunta /);
  assert.match(page, /const r = await agir\(\{ acao: "pedir", texto \}\)/, 'pedido pela fila continua igual (pergunta curta vai para "Perguntar agora", #823)');
  assert.match(R('src/pages/cortex/Composer.tsx'), /"pedido" \| "nota" \| "pergunta"/);
});
