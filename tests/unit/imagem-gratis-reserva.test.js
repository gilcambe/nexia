'use strict';
// Lição 28: imagem nunca para por falta de cota. Workers AI primeiro; se acabar (4006) ou o freio ligar, Hugging Face grátis.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { gerarImagem, HF } = require('../../lib/imagemGratis');

// Hugging Face falso: responde como o Gradio de verdade (POST -> event_id, GET -> SSE com a url, GET url -> bytes).
function hfFalso({ semGpu = false } = {}) {
  const chamadas = [];
  const f = async (url, o = {}) => {
    chamadas.push({ url, corpo: o.body && JSON.parse(o.body) });
    if (url.endsWith('/gradio_api/call/infer')) return new Response(JSON.stringify({ event_id: 'abc' }));
    if (url.endsWith('/gradio_api/call/infer/abc')) {
      return new Response(semGpu ? 'event: error\ndata: null\n\n' : `event: complete\ndata: [{"url": "${HF}/gradio_api/file=/tmp/x/image.webp"}, 7]\n\n`);
    }
    if (url.startsWith(`${HF}/gradio_api/file=`)) return new Response('WEBP', { headers: { 'content-type': 'image/webp' } });
    return new Response('?', { status: 404 });
  };
  return { f, chamadas };
}
const SEM_COTA = { run: async () => { throw new Error('4006: you have used up your daily free allocation of 10,000 neurons'); } };

test('Workers AI com cota: usa ele e não chama o Hugging Face', async () => {
  const hf = hfFalso();
  const r = await gerarImagem({ run: async () => ({ image: Buffer.from('JPG').toString('base64') }) }, 'gato', {}, hf.f);
  assert.equal(r.fonte, 'Workers AI');
  assert.equal(Buffer.from(r.bytes).toString(), 'JPG');
  assert.equal(hf.chamadas.length, 0);
});

test('cota do Workers AI acabou: passa sozinho para o Hugging Face no tamanho pedido', async () => {
  const hf = hfFalso();
  const r = await gerarImagem(SEM_COTA, 'gato', { width: 768, height: 1024, seed: 11 }, hf.f);
  assert.deepEqual([r.fonte, r.tipo, Buffer.from(r.bytes).toString()], ['Hugging Face', 'image/webp', 'WEBP']);
  assert.deepEqual(hf.chamadas[0].corpo.data, ['gato', 11, false, 768, 1024, 6]);
});

test('freio de 80% ligado: nem tenta o Workers AI (fica para os clientes)', async () => {
  let usou = false;
  const r = await gerarImagem({ run: async () => { usou = true; return { image: 'QQ==' }; } }, 'gato', { pularWorkersAi: true }, hfFalso().f);
  assert.equal(usou, false);
  assert.equal(r.fonte, 'Hugging Face');
});

test('as duas sem cota: erro com os dois motivos, nada pago', async () => {
  await assert.rejects(gerarImagem(SEM_COTA, 'gato', {}, hfFalso({ semGpu: true }).f), /Workers AI: 4006.*\| Hugging Face: HF sem cota/);
  const src = fs.readFileSync(path.join(__dirname, '../../lib/imagemGratis.js'), 'utf8') + fs.readFileSync(path.join(__dirname, '../../netlify/functions/cortex-chat.js'), 'utf8');
  assert.doesNotMatch(src, /api\.openai\.com\/v1\/images|model: 'dall-e/i);
});

test('não baixa arquivo de outro endereço que a resposta mande', async () => {
  const f = async (url) => (url.endsWith('/infer') ? new Response('{"event_id":"abc"}') : new Response('event: complete\ndata: [{"url": "https://malicioso.example/x.webp"}]\n'));
  await assert.rejects(gerarImagem(null, 'gato', {}, f), /resposta estranha/);
});

test('corpo-ia e Cortex usam a reserva', async () => {
  const antes = globalThis.fetch;
  globalThis.fetch = hfFalso().f;
  try {
    const { corpoIa } = await import(pathToFileURL(path.join(__dirname, '../../cloudflare/corpoIa.js')).href);
    const r = await corpoIa(new Request('https://x/api/corpo-ia?k=f-media-medio-frente'), { AI: SEM_COTA });
    assert.equal(r.status, 200);
    assert.deepEqual([r.headers.get('content-type'), r.headers.get('x-fonte')], ['image/webp', 'Hugging Face']);
    const chat = require('../../netlify/functions/cortex-chat.js');
    const a = globalThis.__NEXIA_AI__;
    globalThis.__NEXIA_AI__ = SEM_COTA;
    try {
      const c = await chat.generateImage('gato');
      assert.equal(c.ok, true);
      assert.match(c.url, /^data:image\/webp;base64,/);
      assert.match(c.modelo, /Hugging Face/);
    } finally { globalThis.__NEXIA_AI__ = a; }
  } finally { globalThis.fetch = antes; }
});
