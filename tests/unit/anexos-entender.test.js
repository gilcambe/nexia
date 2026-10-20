'use strict';
const test = require('node:test');
const assert = require('node:assert');
const a = require('../../lib/anexos-entender');

const env = { CLOUDFLARE_AI_TOKEN: 't', CLOUDFLARE_AI_ACCOUNT_ID: 'acc' };
const b64 = (s) => Buffer.from(s).toString('base64');
const resp = (status, body) => ({ ok: status < 400, status, json: async () => body });

test('ANX1. tipo pelo nome e pelo mime', () => {
  assert.strictEqual(a.tipoDe('print.png'), 'imagem');
  assert.strictEqual(a.tipoDe('x', 'image/jpeg'), 'imagem');
  assert.strictEqual(a.tipoDe('nota.m4a'), 'audio');
  assert.strictEqual(a.tipoDe('edital.pdf'), 'documento');
  assert.strictEqual(a.tipoDe('planilha.xlsx'), 'documento');
  assert.strictEqual(a.tipoDe('a.csv', 'text/csv'), 'documento');
  assert.strictEqual(a.tipoDe('app.ts'), 'texto');
  assert.strictEqual(a.tipoDe('x.zip', 'application/zip'), 'outro');
});

test('ANX2. texto entra direto, sem IA', async () => {
  const r = await a.entenderAnexo({ nome: 'n.md', base64: b64('# Olá') }, {}, { fetchImpl: async () => { throw new Error('não chama'); } });
  assert.deepStrictEqual(r, { tipo: 'texto', texto: '# Olá' });
});

test('ANX3. imagem → descrição pelo modelo de visão', async () => {
  let pedido;
  const fetchImpl = async (u, i) => { pedido = [String(u), JSON.parse(i.body)]; return resp(200, { success: true, result: { description: 'Tela com botão Entrar.' } }); };
  const r = await a.entenderAnexo({ nome: 'p.png', tipo: 'image/png', base64: b64('PNGDATA') }, env, { fetchImpl });
  assert.deepStrictEqual(r, { tipo: 'imagem', texto: 'Tela com botão Entrar.' });
  assert.ok(pedido[0].endsWith('/accounts/acc/ai/run/' + a.MODELO_VISAO));
  assert.deepStrictEqual(pedido[1].image, [...Buffer.from('PNGDATA')]);
});

test('ANX4. áudio → transcrição (Whisper) e PDF → toMarkdown', async () => {
  const fetchImpl = async (u, i) => {
    if (String(u).includes('whisper')) return resp(200, { success: true, result: { text: 'oi cortex' } });
    if (String(u).endsWith('/ai/tomarkdown')) { assert.ok(i.body instanceof FormData); return resp(200, { success: true, result: [{ name: 'e.pdf', format: 'markdown', data: '# Edital' }] }); }
    return resp(404, {});
  };
  assert.deepStrictEqual(await a.entenderAnexo({ nome: 'v.ogg', base64: b64('OGG') }, env, { fetchImpl }), { tipo: 'audio', texto: 'oi cortex' });
  assert.deepStrictEqual(await a.entenderAnexo({ nome: 'e.pdf', tipo: 'application/pdf', base64: b64('%PDF') }, env, { fetchImpl }), { tipo: 'documento', texto: '# Edital' });
});

test('ANX5. sem chave, arquivo grande, inválido ou IA fora: erro claro, nunca lança', async () => {
  assert.match((await a.entenderAnexo({ nome: 'p.png', base64: b64('x') }, {})).erro, /Workers AI/);
  assert.match((await a.entenderAnexo({ nome: 'p.png', base64: Buffer.alloc(a.MAX_BYTES + 1).toString('base64') }, env)).erro, /grande/);
  assert.match((await a.entenderAnexo({ nome: 'p.png', base64: '!!' }, env)).erro, /inválido/);
  const r = await a.entenderAnexo({ nome: 'p.png', base64: b64('x') }, env, { fetchImpl: async () => resp(500, {}) });
  assert.match(r.erro, /Não consegui entender/);
});

test('ANX6. texto longo é cortado', async () => {
  const r = await a.entenderAnexo({ nome: 'l.txt', base64: b64('a'.repeat(a.MAX_TEXTO + 50)) }, {});
  assert.ok(r.texto.length < a.MAX_TEXTO + 30 && r.texto.endsWith('[… cortado]'));
});

test('ANX7. ação "entender" do Cortex responde sem usar o GitHub', async () => {
  const { agir } = require('../../netlify/functions/central/pedidos-acoes');
  const x = await agir({ gh: async () => { throw new Error('não usa'); } }, { acao: 'entender', nome: 'n.txt', base64: b64('abc') }, 'dono');
  assert.deepStrictEqual(x, { status: 200, corpo: { ok: true, tipo: 'texto', texto: 'abc', mensagem: 'Anexo entendido.' } });
});
