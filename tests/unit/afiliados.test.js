'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const { criarShopee, assinar, itemDoLink, normalizar } = require('../../afiliados/lib/shopee');
const { prepararLink, lerHtmlProduto, lerProduto, lojaDe } = require('../../afiliados/lib/links');
const { montarVitrine, escolherPosts, pontuar } = require('../../afiliados/lib/selecionar');
const { textoPost } = require('../../afiliados/lib/texto');
const { gerarSite } = require('../../afiliados/lib/site');
const { CANAIS, facetasDeLink, oauth1 } = require('../../afiliados/lib/canais');
const robo = require('../../afiliados/robo');
const CONFIG = require('../../afiliados/config.json');

const H = 3600 * 1000;
const DIA = 24 * H;
// 15:00 em Brasília (18:00 UTC), dentro do horário de posts.
const AGORA = Date.UTC(2026, 9, 12, 18, 0, 0);
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'afi-'));

function no(id, extra = {}) {
  return { itemId: id, productName: `Fone Bluetooth ${id}`, commissionRate: '0.08', commission: '3.2', sales: 5400, priceMin: '39.9', priceMax: '49.9',
    priceDiscountRate: 30, ratingStar: '4.8', imageUrl: `https://cf.shopee.com.br/file/${id}`, shopName: 'Loja X', productLink: `https://shopee.com.br/x-i.1.${id}`,
    offerLink: `https://s.shopee.com.br/${id}`, ...extra };
}
function resposta(status, corpo, extra = {}) {
  return { ok: status >= 200 && status < 300, status, url: extra.url, headers: { get: () => extra.tipo || 'application/json' },
    json: async () => corpo, text: async () => (typeof corpo === 'string' ? corpo : JSON.stringify(corpo)), arrayBuffer: async () => new ArrayBuffer(10) };
}

test('AF1 Shopee: assinatura SHA256(AppId+Timestamp+corpo+Senha) no formato da API', () => {
  const h = assinar('123', 'seg', '{"query":"x"}', 1700000000);
  const esperado = crypto.createHash('sha256').update('1231700000000{"query":"x"}seg').digest('hex');
  assert.equal(h, `SHA256 Credential=123, Timestamp=1700000000, Signature=${esperado}`);
});

test('AF2 Shopee: busca assina o corpo enviado, monta a consulta e normaliza os produtos', async () => {
  let pedido;
  const shopee = criarShopee({ appId: '99', segredo: 's', agora: () => 1700000000000, fetchImpl: async (url, op) => {
    pedido = { url, op };
    return resposta(200, { data: { productOfferV2: { nodes: [no(1), { itemId: 2 }], pageInfo: {} } } });
  } });
  const r = await shopee.buscar({ palavra: 'fone "bom"', ordem: 2, limite: 5 });
  assert.equal(pedido.url, 'https://open-api.affiliate.shopee.com.br/graphql');
  assert.equal(pedido.op.headers.Authorization, assinar('99', 's', pedido.op.body, 1700000000));
  const q = JSON.parse(pedido.op.body).query;
  assert.match(q, /productOfferV2\(keyword: "fone \\"bom\\"", sortType: 2, page: 1, limit: 5\)/);
  assert.equal(r.length, 1, 'produto sem nome/link é descartado');
  assert.deepEqual([r[0].id, r[0].preco, r[0].comissao, r[0].nota, r[0].link], ['shopee-1', 39.9, 0.08, 4.8, 'https://s.shopee.com.br/1']);
  assert.equal(r[0].preco_antigo, 57);
});

test('AF3 Shopee: erro da API vira ShopeeErro com o código', async () => {
  const shopee = criarShopee({ appId: '1', segredo: 's', fetchImpl: async () => resposta(200, { errors: [{ message: 'Invalid Signature', extensions: { code: 10020 } }] }) });
  await assert.rejects(shopee.buscar({ palavra: 'x' }), e => e.codigo === 10020 && /Invalid Signature/.test(e.message));
  assert.throws(() => criarShopee({}), /SHOPEE_APP_ID/);
});

test('AF4 links: loja, número do produto da Shopee e regras de link de afiliado', async () => {
  assert.equal(lojaDe('https://www.mercadolivre.com.br/p/MLB123'), 'mercadolivre');
  assert.equal(lojaDe('https://mercadolivre.com/sec/1abc'), 'mercadolivre');
  assert.equal(lojaDe('https://amzn.to/xyz'), 'amazon');
  assert.equal(lojaDe('https://shopee.com.br/x-i.12.345'), 'shopee');
  assert.equal(lojaDe('https://evil.com/mercadolivre.com.br'), null);
  assert.equal(itemDoLink('https://shopee.com.br/Fone-i.123.4567?x=1'), '4567');
  assert.equal(itemDoLink('https://shopee.com.br/product/123/890'), '890');

  assert.match((await prepararLink('https://produto.mercadolivre.com.br/MLB-1-fone')).erro, /não é de afiliado/);
  assert.deepEqual(await prepararLink('https://mercadolivre.com/sec/2xYz'), { loja: 'mercadolivre', link: 'https://mercadolivre.com/sec/2xYz' });
  assert.equal((await prepararLink('https://www.amazon.com.br/dp/B0X?tag=outro-20', { amazonTag: 'meu-20' })).link, 'https://www.amazon.com.br/dp/B0X?tag=meu-20');
  assert.match((await prepararLink('https://www.amazon.com.br/dp/B0X')).erro, /AMAZON_TAG/);
  assert.match((await prepararLink('http://mercadolivre.com/sec/1')).erro, /https/);
  assert.match((await prepararLink('javascript:alert(1)')).erro, /https/);
  assert.match((await prepararLink('https://exemplo.com/x')).erro, /Shopee, do Mercado Livre e da Amazon/);
});

test('AF5 links: lê título, foto e preço do JSON-LD ou do Open Graph; ML cai na API do anúncio', async () => {
  const ld = '<script type="application/ld+json">{"@type":"Product","name":"Air Fryer 4L","image":["https://h/img.jpg"],"offers":{"price":"299.90"},"aggregateRating":{"ratingValue":"4.7"}}</script>';
  assert.deepEqual(lerHtmlProduto(ld), { titulo: 'Air Fryer 4L', imagem: 'https://h/img.jpg', preco: 299.9, nota: 4.7 });
  const og = '<meta property="og:title" content="Kit &amp; Copos"><meta property="og:image" content="https://h/c.png">';
  assert.deepEqual(lerHtmlProduto(og), { titulo: 'Kit & Copos', imagem: 'https://h/c.png', preco: 0, nota: 0 });
  assert.equal(lerHtmlProduto('<title>Captcha</title>'), null);
  const p = await lerProduto('https://mercadolivre.com/sec/abc', { fetchImpl: async u => {
    if (u.startsWith('https://mercadolivre.com/sec/')) return resposta(403, 'bloqueado', { url: 'https://www.mercadolivre.com.br/fone/p/MLB12345678' });
    if (u === 'https://api.mercadolibre.com/items/MLB12345678') return resposta(403, {});
    if (u === 'https://api.mercadolibre.com/products/MLB12345678') return resposta(200, { name: 'Fone ML', pictures: [{ url: 'http://http2.mlstatic.com/a.jpg' }], buy_box_winner: { price: 99 } });
    throw new Error('inesperado ' + u);
  } });
  assert.deepEqual(p, { titulo: 'Fone ML', imagem: 'https://http2.mlstatic.com/a.jpg', preco: 99, nota: 0 });
});

const oferta = (id, extra = {}) => ({ ...normalizar(no(id)), categoria: 'eletronicos', ...extra });

test('AF6 vitrine: filtra nota/vendas/comissão/preço, expira em dias_no_site e ordena por pontos', () => {
  const f = CONFIG.filtros;
  const ruins = [oferta(2, { nota: 4.0 }), oferta(3, { vendas: 3 }), oferta(4, { comissao: 0.01 }), oferta(5, { preco: 900 }), oferta(6, { imagem: '' })];
  const v = montarVitrine([oferta(1), oferta(7, { comissao: 0.14 }), ...ruins], [], f, AGORA);
  assert.deepEqual(v.map(o => o.id), ['shopee-7', 'shopee-1']);
  assert.ok(pontuar(v[0]) > pontuar(v[1]));
  const depois = montarVitrine([], v, f, AGORA + (f.dias_no_site + 1) * DIA);
  assert.equal(depois.length, 0, 'oferta que sumiu da busca sai do site');
  const manual = { ...oferta(9, { nota: 0, vendas: 0, comissao: 0 }), manual: true, visto: AGORA };
  const m = montarVitrine([manual], [], f, AGORA + 10 * DIA);
  assert.equal(m[0].id, 'shopee-9', 'colado à mão entra mesmo sem números e fica 14 dias');
  assert.equal(montarVitrine([manual], [], f, AGORA + 15 * DIA).length, 0, 'e não renova sozinho');
});

test('AF7 anti-spam: horário, limite por dia, intervalo e sem repetir produto em 7 dias', () => {
  const r = CONFIG.divulgacao;
  const v = [oferta(1), oferta(2), oferta(3)];
  assert.deepEqual(escolherPosts(v, [], 'x', r, AGORA).map(o => o.id), ['shopee-1']);
  const madrugada = Date.UTC(2026, 9, 12, 6, 0); // 03:00 em Brasília
  assert.deepEqual(escolherPosts(v, [], 'x', r, madrugada), []);
  const h1 = [{ canal: 'x', id: 'shopee-1', quando: AGORA - 1 * H }];
  assert.deepEqual(escolherPosts(v, h1, 'x', r, AGORA), [], 'menos de 2 h desde o último post');
  const h2 = [{ canal: 'x', id: 'shopee-1', quando: AGORA - 3 * H }];
  assert.deepEqual(escolherPosts(v, h2, 'x', r, AGORA).map(o => o.id), ['shopee-2'], 'não repete o produto');
  assert.deepEqual(escolherPosts(v, h2, 'pinterest', r, AGORA).map(o => o.id), ['shopee-1'], 'cada rede tem o próprio histórico');
  const cheio = Array.from({ length: 6 }, (_, i) => ({ canal: 'x', id: `z${i}`, quando: AGORA - (3 + i) * H }));
  assert.deepEqual(escolherPosts(v, cheio, 'x', r, AGORA), [], 'no máximo 6 por dia');
});

test('AF8 textos: aviso #publi sempre; curto cabe no X (link = 23) e no Bluesky (300)', () => {
  const o = oferta(1, { titulo: 'Fone de Ouvido Bluetooth '.repeat(20) });
  const longo = textoPost(o, { quando: AGORA });
  assert.match(longo, /#publi Link de afiliado/);
  assert.match(longo, /conferido às 15:00/);
  assert.match(longo, /R\$ 39,90 \(antes R\$ 57,00, -30%\)/);
  const x = textoPost(o, { curto: true });
  assert.ok(x.length - o.link.length + 23 <= 280, `X: ${x.length}`);
  assert.match(x, /#publi/);
  const bsky = textoPost({ ...o, link: 'https://s.shopee.com.br/' + 'a'.repeat(60) }, { curto: true, limite: 290, linkConta: null });
  assert.ok(bsky.length <= 300, `Bluesky: ${bsky.length}`);
});

test('AF9 Bluesky marca o link por byte UTF-8 (emoji conta 4 bytes)', () => {
  const t = '🔥 Oferta\nhttps://s.shopee.com.br/abc';
  const [f] = facetasDeLink(t);
  assert.equal(Buffer.from(t).subarray(f.index.byteStart, f.index.byteEnd).toString(), 'https://s.shopee.com.br/abc');
});

test('AF10 X: cabeçalho OAuth 1.0a com assinatura HMAC-SHA1 reproduzível', () => {
  const env = { X_API_KEY: 'ck', X_API_SECRET: 'cs', X_ACCESS_TOKEN: 'at', X_ACCESS_SECRET: 'as' };
  const h = oauth1('POST', 'https://api.x.com/2/tweets', env, { nonce: 'n', ts: 1 });
  const base = 'POST&https%3A%2F%2Fapi.x.com%2F2%2Ftweets&oauth_consumer_key%3Dck%26oauth_nonce%3Dn%26oauth_signature_method%3DHMAC-SHA1%26oauth_timestamp%3D1%26oauth_token%3Dat%26oauth_version%3D1.0';
  const sig = crypto.createHmac('sha1', 'cs&as').update(base).digest('base64');
  assert.ok(h.startsWith('OAuth oauth_consumer_key="ck"'));
  assert.ok(h.includes(`oauth_signature="${encodeURIComponent(sig)}"`));
});

test('AF11 site: páginas, aviso de afiliado, rel=sponsored, escapa HTML e recusa link que não é https', () => {
  const pasta = tmp();
  const ruim = oferta(5, { titulo: '<script>alert(1)</script> Copo', link: 'javascript:alert(1)' });
  const xss = oferta(6, { titulo: '"><img src=x onerror=alert(1)> Garrafa' });
  const arq = gerarSite(CONFIG, [oferta(1), ruim, xss], pasta, AGORA);
  for (const f of ['index.html', 'privacidade.html', 'whatsapp/index.html', 'feed.xml', 'sitemap.xml', 'robots.txt', 'estilo.css', 'p/shopee-1/index.html', 'p/shopee-6/index.html']) assert.ok(arq.includes(f), f);
  assert.ok(!arq.includes('p/shopee-5/index.html'), 'oferta com link inválido não entra');
  const index = fs.readFileSync(path.join(pasta, 'index.html'), 'utf8');
  assert.match(index, /links deste site são de afiliado/);
  assert.match(index, /rel="sponsored nofollow noopener"/);
  assert.ok(!index.includes('<img src=x'), 'título é escapado');
  assert.ok(!index.includes('javascript:'));
  assert.match(fs.readFileSync(path.join(pasta, 'sitemap.xml'), 'utf8'), /https:\/\/achados-nexia\.pages\.dev\/p\/shopee-1\//);
  const wa = fs.readFileSync(path.join(pasta, 'whatsapp/index.html'), 'utf8');
  assert.match(wa, /https:\/\/wa\.me\/\?text=/);
  assert.match(wa, /noindex/);
});

test('AF12 rodar: busca na Shopee, gera o site, posta nas redes ligadas e guarda o histórico', async () => {
  const dados = tmp(), saida = tmp();
  const chamadas = [];
  const realFetch = global.fetch;
  global.fetch = async (url, op = {}) => {
    chamadas.push(url);
    if (url.includes('affiliate.shopee')) {
      const q = JSON.parse(op.body).query;
      const base = q.length % 7 * 10; // ids diferentes por busca
      return resposta(200, { data: { productOfferV2: { nodes: [no(100 + base), no(101 + base)] } } });
    }
    if (url.includes('api.telegram.org')) return resposta(200, { ok: true, result: { message_id: 7 } });
    throw new Error('inesperado ' + url);
  };
  try {
    const env = { SHOPEE_APP_ID: '1', SHOPEE_SECRET: 's', TELEGRAM_BOT_TOKEN: 't', TELEGRAM_CANAL: '@achados' };
    const r = await robo.rodar({ dados, saida, env, agora: AGORA });
    assert.ok(r.vitrine.length >= 2);
    assert.equal(chamadas.filter(u => u.includes('affiliate.shopee')).length, CONFIG.categorias.length, '1 busca por categoria por rodada');
    assert.equal(chamadas.filter(u => u.includes('telegram')).length, 1, '1 post por rodada');
    const hist = JSON.parse(fs.readFileSync(path.join(dados, 'historico.json'), 'utf8'));
    assert.deepEqual(hist.map(h => h.canal), ['telegram']);
    assert.ok(fs.existsSync(path.join(saida, 'index.html')));
    // 1 hora depois: nada de novo post (intervalo de 2 h).
    await robo.rodar({ dados, saida, env, agora: AGORA + H });
    assert.equal(chamadas.filter(u => u.includes('telegram')).length, 1);
    // Falha numa rede não derruba a rodada nem entra no histórico.
    global.fetch = async url => (url.includes('telegram') ? resposta(400, { description: 'chat not found' }) : resposta(200, { data: { productOfferV2: { nodes: [] } } }));
    const r3 = await robo.rodar({ dados, saida, env, agora: AGORA + 3 * H });
    assert.ok(r3.log.some(l => /Canal do Telegram: falhou \(Telegram: chat not found\)/.test(l)));
    assert.equal(JSON.parse(fs.readFileSync(path.join(dados, 'historico.json'), 'utf8')).length, 1);
  } finally { global.fetch = realFetch; }
});

test('AF13 adicionar e remover produto colado à mão (Mercado Livre)', async () => {
  const dados = tmp();
  const html = '<meta property="og:title" content="Garrafa Térmica 1L"><meta property="og:image" content="https://http2.mlstatic.com/g.jpg">';
  const fetchImpl = async () => resposta(200, html, { url: 'https://www.mercadolivre.com.br/garrafa/p/MLB99999999' });
  const ruim = await robo.adicionar({ link: 'https://www.mercadolivre.com.br/garrafa/p/MLB99999999', dados, env: {}, fetchImpl });
  assert.match(ruim.erro, /não é de afiliado/);
  const r = await robo.adicionar({ link: 'https://mercadolivre.com/sec/1AbC', dados, env: {}, agora: AGORA, fetchImpl });
  assert.equal(r.ok, true);
  assert.equal(r.oferta.titulo, 'Garrafa Térmica 1L');
  const man = JSON.parse(fs.readFileSync(path.join(dados, 'manuais.json'), 'utf8'));
  assert.equal(man.length, 1);
  assert.equal(robo.remover({ alvo: 'https://mercadolivre.com/sec/1AbC', dados }), 1);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dados, 'manuais.json'), 'utf8')).length, 0);
});

test('AF14 canais: cada rede só liga com os próprios segredos; WhatsApp não é automático', () => {
  assert.deepEqual(CANAIS.map(c => c.id).sort(), ['bluesky', 'facebook', 'instagram', 'pinterest', 'telegram', 'x']);
  for (const c of CANAIS) assert.equal(c.ativo({}), false, c.id);
  assert.equal(CANAIS.find(c => c.id === 'pinterest').ativo({ PINTEREST_APP_ID: 1, PINTEREST_APP_SECRET: 1, PINTEREST_REFRESH_TOKEN: 1 }), false);
});

test('AF15 workflow: a cada 2 h, segredos um a um, estado na branch afiliados-dados e não publica site vazio', () => {
  const wf = fs.readFileSync(path.join(__dirname, '../../.github/workflows/afiliados.yml'), 'utf8');
  assert.match(wf, /cron: '17 \*\/2 \* \* \*'/);
  assert.match(wf, /afiliados-dados/);
  assert.match(wf, /\[ -d "\$RUNNER_TEMP\/site\/p" \]/);
  const usados = new Set([...fs.readFileSync(path.join(__dirname, '../../afiliados/lib/canais.js'), 'utf8').matchAll(/env\.([A-Z_]+)/g)].map(m => m[1]));
  for (const s of usados) assert.match(wf, new RegExp(`${s}: \\$\\{\\{ secrets\\.${s} \\}\\}`), s);
  assert.ok(!/toJSON\(secrets\)/.test(wf));
  assert.deepEqual(robo.buscasDaRodada(CONFIG, AGORA).length, CONFIG.categorias.length);
});
