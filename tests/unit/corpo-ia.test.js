// Worker: fotos do corpo realista (Workers AI grátis) só a partir de uma lista fechada de chaves.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const carregar = () => import(pathToFileURL(path.join(__dirname, '../../cloudflare/corpoIa.js')).href);

test('corpo-ia: recusa chave fora da lista e devolve JPEG com a chave certa', async () => {
  const { corpoIa } = await carregar();
  assert.equal((await corpoIa(new Request('https://x/api/corpo-ia?k=qualquer coisa'), {})).status, 400);
  assert.equal((await corpoIa(new Request('https://x/api/corpo-ia?k=m-clara-magro-frente'), {})).status, 503);
  let pedido;
  const env = { AI: { run: async (modelo, entrada) => { pedido = { modelo, entrada }; return { image: Buffer.from('jpg').toString('base64') }; } } };
  const r = await corpoIa(new Request('https://x/api/corpo-ia?k=f-negra-alto-lado'), env);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'image/jpeg');
  assert.equal(Buffer.from(await r.arrayBuffer()).toString(), 'jpg');
  assert.match(pedido.modelo, /flux-1-schnell/);
  assert.match(pedido.entrada.prompt, /woman.*dark black skin.*overweight.*side view/);
});
