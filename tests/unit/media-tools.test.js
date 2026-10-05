'use strict';
const test = require('node:test');
const assert = require('node:assert');
const tools = require('../../nexia-ai/tool-gateway/tools/media');
const images = tools.find(t => t.name === 'media.search_images');
const videos = tools.find(t => t.name === 'media.search_videos');

const json = body => ({ ok: true, status: 200, json: async () => body });
const fake = routes => {
  const calls = [];
  return { calls, fetchImpl: async (url, init) => { calls.push({ url, init }); const r = routes.find(([re]) => re.test(url)); return r ? json(r[1]) : { ok: false, status: 404, json: async () => ({}) }; } };
};
const OV = { results: [
  { url: 'https://live.staticflickr.com/1/pao.jpg', width: 2000, height: 1300, title: 'Fresh bread', creator: 'Ana', license: 'by', license_version: '2.0', foreign_landing_url: 'https://flickr.com/p/1' },
  { url: 'https://x.org/tiny.jpg', width: 300, height: 200, title: 'tiny', creator: 'B', license: 'cc0' },
  { url: 'https://x.org/doc.pdf', width: 2000, height: 2000, title: 'pdf', creator: 'C', license: 'cc0' },
] };
const WM = { query: { pages: { 1: { title: 'File:Padaria.jpg', imageinfo: [{ mime: 'image/jpeg', thumburl: 'https://upload.wikimedia.org/t/1600px-Padaria.jpg', thumbwidth: 1600, thumbheight: 1066,
  descriptionurl: 'https://commons.wikimedia.org/wiki/File:Padaria.jpg', extmetadata: { Artist: { value: '<a href="x">José</a>' }, LicenseShortName: { value: 'CC BY-SA 4.0' } } }] } } } };

test('MD1. fotos sem chave: Openverse (só imagens grandes) e Wikimedia completa; crédito e licença vêm junto', async () => {
  const f = fake([[/openverse/, OV], [/wikimedia/, WM]]);
  const r = await images.run({ env: {}, fetchImpl: f.fetchImpl }, { query: 'artisan bread', count: 2 });
  assert.deepStrictEqual(r.images.map(i => i.provider), ['openverse', 'wikimedia']);
  assert.strictEqual(r.images[0].url, 'https://live.staticflickr.com/1/pao.jpg');
  assert.match(r.images[0].credit, /Ana .*BY 2\.0/);
  assert.match(r.images[1].credit, /^José \(CC BY-SA 4\.0/);
  assert.ok(!f.calls.some(c => /pexels/.test(c.url)), 'sem PEXELS_API_KEY não chama a Pexels');
  assert.match(f.calls[0].init.headers['User-Agent'], /NEXIA/);
});

test('MD2. com PEXELS_API_KEY (grátis) a Pexels vem primeiro; vídeo escolhe mp4 >= 1280', async () => {
  const f = fake([[/api\.pexels\.com\/v1/, { photos: [{ src: { original: 'https://images.pexels.com/1.jpeg' }, width: 4000, height: 3000, alt: 'Pães', photographer: 'Lia', url: 'https://pexels.com/p/1' }] }],
    [/api\.pexels\.com\/videos/, { videos: [{ image: 'https://images.pexels.com/v.jpg', url: 'https://pexels.com/v/1', user: { name: 'Rui' },
      video_files: [{ file_type: 'video/mp4', width: 640, height: 360, link: 'https://v/640.mp4' }, { file_type: 'video/mp4', width: 1920, height: 1080, link: 'https://v/1920.mp4' }] }] }]]);
  const deps = { env: { PEXELS_API_KEY: 'k' }, fetchImpl: f.fetchImpl };
  const r = await images.run(deps, { query: 'bakery', count: 1 });
  assert.strictEqual(r.images[0].provider, 'pexels');
  assert.strictEqual(f.calls[0].init.headers.Authorization, 'k');
  const v = await videos.run(deps, { query: 'bakery', count: 1 });
  assert.deepStrictEqual([v.videos[0].url, v.videos[0].poster], ['https://v/1920.mp4', 'https://images.pexels.com/v.jpg']);
});

test('MD3. nada encontrado (ou serviços fora): erro UPSTREAM com dica, nunca lista vazia como sucesso', async () => {
  await assert.rejects(images.run({ env: {}, fetchImpl: async () => { throw new Error('rede'); } }, { query: 'fresh bread' }), e => e.code === 'UPSTREAM');
});

test('MD5. GIFs (Openverse extension=gif) e músicas (Openverse áudio) grátis, com crédito', async () => {
  const gifTool = tools.find(t => t.name === 'media.search_gifs');
  const audioTool = tools.find(t => t.name === 'media.search_audio');
  const f = fake([[/openverse\.org\/v1\/images.*extension=gif/, { results: [{ url: 'https://x.org/a.gif', width: 480, height: 270, title: 'Coffee pour', creator: 'Ana', license: 'by', license_version: '4.0' }, { url: 'https://x.org/b.jpg', width: 900 }] }],
    [/openverse\.org\/v1\/audio/, { results: [{ url: 'https://cdn.x/song.mp3', title: 'Calm piano', creator: 'Rui', license: 'by', license_version: '3.0', duration: 125000 }, { url: 'https://cdn.x/beep.mp3', duration: 2000 }] }]]);
  const g = await gifTool.run({ env: {}, fetchImpl: f.fetchImpl }, { query: 'coffee pour', count: 1 });
  assert.strictEqual(g.gifs[0].url, 'https://x.org/a.gif');
  assert.strictEqual(g.gifs[0].mime, 'image/gif');
  assert.match(g.gifs[0].credit, /Ana .*BY 4\.0/);
  const a = await audioTool.run({ env: {}, fetchImpl: f.fetchImpl }, { query: 'calm piano', count: 3 });
  assert.deepStrictEqual(a.audio.map(x => x.url), ['https://cdn.x/song.mp3'], 'som curto (2 s) não serve de música');
  assert.strictEqual(a.audio[0].duration, 125);
  assert.match(a.audio[0].credit, /^Música: Calm piano — Rui/);
  assert.ok(gifTool.risk === 'LOW' && audioTool.risk === 'LOW');
});
