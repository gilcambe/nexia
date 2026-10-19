'use strict';
// Divulga: 8 modelos de tela com a cor de cada cliente (#989) e carrossel no Instagram / álbum no Facebook (#991).
// Tudo com fetch falso: nenhuma chamada real à Meta.
const test = require('node:test');
const assert = require('node:assert');
const { telaModelo, carrosselRoteiro, contraste, MODELOS, carrossel } = require('../../divulga/lib/visual');
const { CANAIS } = require('../../divulga/lib/canais');
const { montar } = require('../../divulga/robo');

const cliente = { id: 'x', nome: 'Studio Teste', instagram: 'studio_teste', cores: { fundo: '#1e1311', destaque: '#ca9252' }, assuntos: ['a', 'b', 'c'] };
const ENV = { DIVULGA_META_PAGE_ID: '1', DIVULGA_META_PAGE_TOKEN: 't', DIVULGA_META_IG_USER_ID: '2', DIVULGA_PAUSA_MS: '0' };
const ig = CANAIS.find(c => c.id === 'instagram');
const fb = CANAIS.find(c => c.id === 'facebook');
const img = n => `https://exemplo.com/tela-${n}.png`;

/** fetch falso que anota cada chamada (método, caminho e corpo) e devolve ids em sequência. */
function falso() {
  const chamadas = [];
  let n = 0;
  const fetchImpl = async (u, o = {}) => {
    const url = new URL(String(u));
    chamadas.push({ m: o.method || 'GET', p: url.pathname.replace(/^\/v[\d.]+/, ''), b: Object.fromEntries(new URLSearchParams(String(o.body || ''))) });
    n += 1;
    return { ok: true, status: 200, json: async () => ({ id: `id${n}`, post_id: `post${n}`, status_code: 'FINISHED' }) };
  };
  return { chamadas, fetchImpl, posts: () => chamadas.filter(c => c.m === 'POST') };
}

test('DC1. cada um dos 8 modelos escapa o título, usa o @ do cliente e não tem "undefined"', () => {
  assert.equal(MODELOS.length, 8);
  for (const m of ['capa', 'lista', 'mito-verdade', 'passo', 'comparacao', 'citacao', 'prova', 'cta']) assert.ok(MODELOS.includes(m), m);
  for (const m of MODELOS) {
    const html = telaModelo(m, cliente, { titulo: 'Oi <b>&"x"', texto: 'Texto <i>', ordem: 2, de: 5 });
    assert.match(html, /Oi &lt;b&gt;&amp;&quot;x&quot;/, `${m}: título escapado`);
    assert.doesNotMatch(html, /<b>&/, `${m}: sem HTML cru`);
    assert.doesNotMatch(html, /undefined|null|NaN/, `${m}: sem undefined`);
    assert.match(html, /@studio_teste/, `${m}: @ do cliente`);
    assert.doesNotMatch(html, /nexiabodycoach|Body Coach/, `${m}: não fixa Body Coach`);
    assert.match(html, /#1e1311/, `${m}: cor de fundo do cliente`);
    assert.doesNotMatch(html, /src="https?:/, `${m}: sem imagem externa`);
  }
  // Selo de mito/verdade e progresso do passo.
  assert.match(telaModelo('mito-verdade', cliente, { titulo: 'Verdade', texto: 'x' }), /VERDADE/);
  assert.match(telaModelo('mito-verdade', cliente, { titulo: 'Mito', texto: 'x' }), /MITO/);
  assert.match(telaModelo('passo', cliente, { titulo: 't', texto: 'x', passo: 2, total: 5 }), /Passo 2 de 5[\s\S]*width:40%/);
  // Logo externo é ignorado (só SVG/data embutido); sem logo, vai a inicial.
  assert.doesNotMatch(telaModelo('capa', { ...cliente, logo: 'https://site.com/logo.png' }, { titulo: 'x' }), /site\.com/);
  // A tela antiga continua igual (Body Coach).
  assert.match(carrossel({ nome: 'NEXIA Body Coach', assuntos: [] })[0], /@nexiabodycoach/);
});

test('DC2. contraste(): preto x branco 21, mesma cor 1, cinza claro em branco reprova', () => {
  assert.equal(contraste('#000000', '#ffffff'), 21);
  assert.equal(contraste('#ca9252', '#ca9252'), 1);
  assert.ok(contraste('#aaaaaa', '#fff') < 4.5);
  // Fundo claro do cliente: o texto vira preto para continuar legível.
  assert.match(telaModelo('lista', { ...cliente, cores: { fundo: '#F7F4EF', destaque: '#B8935A' } }, { titulo: 't', texto: 'x' }), /color:#000000/);
});

test('DC3. carrosselRoteiro: capa + telas + CTA, modelo conforme a série', () => {
  const roteiro = { serie: 'mito-verdade', gancho: 'Mito ou verdade?', telas: [1, 2, 3, 4, 5].map(n => ({ titulo: n % 2 ? 'Mito' : 'Verdade', texto: `t${n}` })), cta: 'Salve', pergunta: 'E você?' };
  const telas = carrosselRoteiro(cliente, roteiro);
  assert.equal(telas.length, 7);
  assert.match(telas[0], /m-capa/);
  assert.match(telas[1], /MITO/);
  assert.match(telas[2], /VERDADE/);
  assert.match(telas[6], /Compartilhe/);
  assert.match(telas[6], /7\/7/);
  assert.match(carrosselRoteiro(cliente, { ...roteiro, serie: 'passo-a-passo' })[1], /Passo 1 de 5/);
  assert.match(carrosselRoteiro(cliente, { ...roteiro, serie: '3-erros' })[1], /m-n/);
});

test('DC4. Instagram: carrossel de 3 imagens = 3 filhos + 1 CAROUSEL + 1 publish, nessa ordem', async () => {
  const f = falso();
  await ig.publicar({ texto: 'Legenda', imagem: img(1), imagens: [img(1), img(2), img(3)] }, { env: ENV, fetchImpl: f.fetchImpl });
  const p = f.posts();
  assert.deepEqual(p.map(c => c.p), ['/2/media', '/2/media', '/2/media', '/2/media', '/2/media_publish']);
  assert.deepEqual(p.slice(0, 3).map(c => [c.b.image_url, c.b.is_carousel_item]), [[img(1), 'true'], [img(2), 'true'], [img(3), 'true']]);
  assert.equal(p[3].b.media_type, 'CAROUSEL');
  assert.equal(p[3].b.children.split(',').length, 3);
  assert.equal(p[3].b.caption, 'Legenda');
  // Publica o id devolvido pelo container CAROUSEL.
  const iCarousel = f.chamadas.findIndex(c => c.b.media_type === 'CAROUSEL');
  assert.equal(p[4].b.creation_id, `id${iCarousel + 1}`);
  // Cada filho foi esperado (consulta de status) antes do CAROUSEL.
  assert.ok(f.chamadas.slice(0, iCarousel).filter(c => c.m === 'GET').length >= 3);
});

test('DC5. Instagram: com 12 imagens envia só 10; URL não pública é recusada', async () => {
  const f = falso();
  await ig.publicar({ texto: 'x', imagens: Array.from({ length: 12 }, (_, i) => img(i)) }, { env: ENV, fetchImpl: f.fetchImpl });
  assert.equal(f.posts().filter(c => c.b.is_carousel_item).length, 10);
  assert.equal(f.posts().find(c => c.b.media_type === 'CAROUSEL').b.children.split(',').length, 10);
  const g = falso();
  await assert.rejects(() => ig.publicar({ texto: 'x', imagens: [img(1), 'http://localhost/a.png'] }, { env: ENV, fetchImpl: g.fetchImpl }), /carrossel/);
  assert.equal(g.chamadas.length, 0);
});

test('DC6. Facebook: álbum sobe 3 fotos sem publicar e chama /feed com 3 attached_media', async () => {
  const f = falso();
  await fb.publicar({ texto: 'Oi', link: 'https://site.com/', imagens: [img(1), img(2), img(3)] }, { env: ENV, fetchImpl: f.fetchImpl });
  const p = f.posts();
  assert.deepEqual(p.map(c => c.p), ['/1/photos', '/1/photos', '/1/photos', '/1/feed']);
  assert.ok(p.slice(0, 3).every(c => c.b.published === 'false'));
  const feed = p[3].b;
  assert.deepEqual([0, 1, 2].map(i => JSON.parse(feed[`attached_media[${i}]`]).media_fbid), ['id1', 'id2', 'id3']);
  assert.equal(feed['attached_media[3]'], undefined);
  assert.match(feed.message, /Oi[\s\S]*site\.com/);
});

test('DC7. post antigo sem imagens faz as mesmas chamadas de hoje; Reels manda cover_url', async () => {
  const f = falso();
  await ig.publicar({ texto: 'x', imagem: img(1) }, { env: ENV, fetchImpl: f.fetchImpl });
  assert.deepEqual(f.chamadas.map(c => `${c.m} ${c.p}`), ['POST /2/media', 'GET /id1', 'POST /2/media_publish']);
  assert.equal(f.chamadas[0].b.image_url, img(1));
  const g = falso();
  await fb.publicar({ texto: 'x', imagem: img(1) }, { env: ENV, fetchImpl: g.fetchImpl });
  assert.deepEqual(g.chamadas.map(c => `${c.m} ${c.p}`), ['POST /1/photos']);
  const r = falso();
  await ig.publicar({ texto: 'x', imagem: img(1), video: 'https://exemplo.com/v.mp4', capa: img(9) }, { env: ENV, fetchImpl: r.fetchImpl });
  assert.equal(r.chamadas[0].b.cover_url, img(9));
  assert.equal(r.chamadas[0].b.media_type, 'REELS');
});

test('DC8. robo.montar repassa imagens para Instagram e Facebook só quando a fila manda', () => {
  const c = { id: 'x', nome: 'X', link: 'https://x.com/' };
  const com = montar({ cliente: c, legenda: 'oi', imagem: img(1), imagens: [img(1), img(2)] });
  assert.deepEqual(com.porRede('instagram').imagens, [img(1), img(2)]);
  assert.deepEqual(com.porRede('facebook').imagens, [img(1), img(2)]);
  const sem = montar({ cliente: c, legenda: 'oi', imagem: img(1) });
  assert.equal('imagens' in sem.porRede('instagram'), false);
  assert.equal('imagens' in sem.porRede('facebook'), false);
});
