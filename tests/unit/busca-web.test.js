'use strict';
const test = require('node:test');
const assert = require('node:assert');
const b = require('../../lib/busca-web');

const HTML = `
<div class="result results_links"><a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexemplo.com%2Fa&amp;rut=x">Título <b>A</b> &amp; cia</a>
<a class="result__snippet" href="#">Trecho do <b>A</b>.</a></div>
<div class="result"><a class="result__a" href="https://duckduckgo.com/y.js?ad_provider=x">Anúncio</a></div>
<div class="result"><a class="result__a" href="https://site-b.com.br/x">B</a><div class="result__snippet">Trecho B</div></div>`;

const resp = (status, body, tipo = 'json') => ({ ok: status < 400, status, text: async () => body, json: async () => (tipo === 'json' ? body : {}) });

test('BW1. lê resultados do DuckDuckGo HTML, tira anúncio e decodifica o link real', () => {
  assert.deepStrictEqual(b.lerDuckDuckGo(HTML), [
    { titulo: 'Título A & cia', url: 'https://exemplo.com/a', trecho: 'Trecho do A.' },
    { titulo: 'B', url: 'https://site-b.com.br/x', trecho: 'Trecho B' },
  ]);
  assert.strictEqual(b.urlReal('javascript:alert(1)'), '');
});

test('BW2. buscar usa o DuckDuckGo e monta contexto numerado e fontes', async () => {
  const r = await b.buscar('preço do pão', { fetchImpl: async (u) => (/html\.duckduckgo\.com/.test(String(u)) ? resp(200, HTML, 'html') : resp(403, '')) });
  assert.strictEqual(r.de, 'duckduckgo');
  assert.match(r.contexto, /\[1\] Título A & cia — https:\/\/exemplo\.com\/a/);
  assert.match(r.contexto, /cite com \[n\]/);
  assert.match(r.rodape, /\*\*Fontes\*\*\n1\. \[Título A & cia\]\(https:\/\/exemplo\.com\/a\)\n2\. \[B\]/);
});

test('BW3. DuckDuckGo fora ou vazio → Google News RSS → Wikipédia; nada → aviso de busca vazia', async () => {
  const rssXml = `<rss><channel><item><title>Notícia de Teste IA</title><link>https://noticias.com/ia</link><pubDate>Mon, 26 Oct 2026 10:00:00 GMT</pubDate></item></channel></rss>`;
  const rNews = await b.buscar('noticias ia', { fetchImpl: async (u) => (String(u).includes('news.google.com') ? resp(200, rssXml, 'xml') : resp(403, '')) });
  assert.strictEqual(rNews.de, 'google_news');
  assert.strictEqual(rNews.fontes[0].titulo, 'Notícia de Teste IA');
  assert.strictEqual(rNews.fontes[0].url, 'https://noticias.com/ia');

  const wiki = { query: { search: [{ title: 'Cloudflare Workers', snippet: '<span>plataforma</span> serverless' }] } };
  const rWiki = await b.buscar('workers', { fetchImpl: async (u) => (String(u).includes('wikipedia') ? resp(200, wiki) : resp(403, '')) });
  assert.strictEqual(rWiki.de, 'wikipedia');
  assert.deepStrictEqual(rWiki.fontes, [{ titulo: 'Cloudflare Workers', url: 'https://pt.wikipedia.org/wiki/Cloudflare_Workers', trecho: 'plataforma serverless' }]);

  const nada = await b.buscar('x y', { fetchImpl: async () => { throw new Error('sem rede'); } });
  assert.deepStrictEqual(nada.fontes, []);
  assert.match(nada.contexto, /não encontrei fontes agora/i);
  assert.strictEqual((await b.buscar('')).fontes.length, 0);
});

test('BW5. cotação do dólar pela AwesomeAPI e fonte lenta não derruba as outras (#1733)', async () => {
  const cot = { USDBRL: { bid: '5.42', ask: '5.43', pctChange: '0.1', create_date: '2026-10-26 10:00:00' } };
  const r = await b.buscar('Qual é a cotação do dólar hoje?', { fetchImpl: async (u) => (String(u).includes('awesomeapi') ? resp(200, cot) : resp(403, '')) });
  assert.strictEqual(r.de, 'cotacao');
  assert.match(r.contexto, /Dólar: compra R\$ 5\.42/);
  const wiki = { query: { search: [{ title: 'Copa do Mundo FIFA de 2022', snippet: 'Argentina campeã' }] } };
  const lento = await b.buscar('Quem ganhou a Copa de 2022? Cite a fonte.', { ms: 50, fetchImpl: async (u) => (String(u).includes('wikipedia') ? resp(200, wiki) : new Promise(() => {})) });
  assert.strictEqual(lento.de, 'wikipedia');
  assert.match(lento.contexto, /Argentina campeã/);
});

test('BW4. Central parte=busca (só master)', async () => {
  const { createHandler } = require('../../netlify/functions/central.js');
  const master = { verifyBearerToken: async () => ({ ok: true, role: 'master' }) };
  const r = await createHandler({ getMw: () => master, fetch: async () => resp(200, HTML, 'html') })({ httpMethod: 'GET', headers: {}, queryStringParameters: { parte: 'busca', q: 'teste' } });
  assert.strictEqual(r.statusCode, 200);
  assert.strictEqual(JSON.parse(r.body).fontes.length, 2);
  const outro = { verifyBearerToken: async () => ({ ok: true, role: 'user' }) };
  assert.strictEqual((await createHandler({ getMw: () => outro })({ httpMethod: 'GET', headers: {}, queryStringParameters: { parte: 'busca', q: 'x' } })).statusCode, 403);
});
