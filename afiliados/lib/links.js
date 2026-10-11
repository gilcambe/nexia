'use strict';
// Links colados à mão (Mercado Livre, Amazon e Shopee): identifica a loja, garante que o link é de afiliado
// e lê título, foto e preço da própria página do produto (dados estruturados JSON-LD ou Open Graph).

function hostDe(u) {
  try { return new URL(u).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; }
}

function lojaDe(u) {
  const h = hostDe(u);
  if (/(^|\.)mercadoli(vre|bre)\.com(\.br)?$/.test(h)) return 'mercadolivre';
  if (h === 'amzn.to' || /(^|\.)amazon\.com\.br$/.test(h)) return 'amazon';
  if (/(^|\.)shopee\.com\.br$/.test(h) || h === 's.shopee.com.br' || h === 'shp.ee') return 'shopee';
  return null;
}

/**
 * Valida o link e devolve { loja, link } com o link de afiliado final, ou { erro } com a explicação.
 * Amazon: o código de associado entra sozinho (tag=). Mercado Livre: só aceita o link gerado no programa de
 * afiliados (mercadolivre.com/sec/... ou com matt_tool), porque link comum não paga comissão.
 * Shopee: link de produto vira link curto de afiliado pela API (precisa de `shopee`).
 */
async function prepararLink(bruto, { amazonTag, shopee } = {}) {
  const url = String(bruto || '').trim();
  let u;
  try { u = new URL(url); } catch { return { erro: 'Isso não parece um link. Copie o endereço inteiro, começando com https://' }; }
  if (u.protocol !== 'https:') return { erro: 'O link precisa começar com https://' };
  const loja = lojaDe(url);
  if (!loja) return { erro: 'Por enquanto só aceito links da Shopee, do Mercado Livre e da Amazon.' };
  if (loja === 'mercadolivre') {
    const afiliado = /^\/sec\//.test(u.pathname) || u.searchParams.has('matt_tool');
    if (!afiliado) return { erro: 'Esse link do Mercado Livre não é de afiliado. No app, abra o produto, toque em Compartilhar na barra de afiliados e copie o link (começa com mercadolivre.com/sec/).' };
    return { loja, link: url };
  }
  if (loja === 'amazon') {
    if (hostDe(url) === 'amzn.to') return { loja, link: url };
    if (!amazonTag) return { erro: 'Falta o seu código de associado da Amazon (segredo AMAZON_TAG).' };
    u.searchParams.set('tag', amazonTag);
    return { loja, link: u.toString() };
  }
  if (['s.shopee.com.br', 'shp.ee'].includes(hostDe(url))) return { loja, link: url };
  if (!shopee) return { erro: 'Para links da Shopee faltam as chaves da API (SHOPEE_APP_ID e SHOPEE_SECRET).' };
  return { loja, link: await shopee.linkCurto(url, 'manual') };
}

function decodificar(s) {
  return String(s || '').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();
}
function meta(html, prop) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*>`, 'i');
  const tag = (html.match(re) || [])[0];
  if (!tag) return '';
  return decodificar((tag.match(/content=["']([^"']*)["']/i) || [])[1]);
}
function produtoJsonLd(html) {
  const blocos = html.match(/<script[^>]+application\/ld\+json[^>]*>[\s\S]*?<\/script>/gi) || [];
  for (const b of blocos) {
    let j;
    try { j = JSON.parse(b.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '')); } catch { continue; }
    const lista = Array.isArray(j) ? j : (j['@graph'] || [j]);
    const p = lista.find(x => x && (x['@type'] === 'Product' || (Array.isArray(x['@type']) && x['@type'].includes('Product'))));
    if (p) return p;
  }
  return null;
}

/** Lê título, foto e preço da página do produto. Devolve null se a loja bloquear a leitura. */
function lerHtmlProduto(html) {
  const p = produtoJsonLd(html);
  const ofertas = p && (Array.isArray(p.offers) ? p.offers[0] : p.offers);
  const titulo = decodificar((p && p.name) || meta(html, 'og:title') || (html.match(/<title>([^<]*)<\/title>/i) || [])[1]);
  const imgLd = p && (Array.isArray(p.image) ? p.image[0] : p.image);
  const imagem = (typeof imgLd === 'string' && imgLd) || meta(html, 'og:image');
  const preco = Number((ofertas && (ofertas.price || ofertas.lowPrice)) || meta(html, 'product:price:amount') || 0) || 0;
  const nota = Number(p && p.aggregateRating && p.aggregateRating.ratingValue) || 0;
  if (!titulo || !/^https:\/\//.test(imagem || '')) return null;
  return { titulo: titulo.slice(0, 200), imagem, preco, nota };
}

/** Mercado Livre: se a página bloquear robôs, tenta a API pública do anúncio (MLB...). */
async function lerMercadoLivreApi(urlFinal, fetchImpl) {
  const m = String(urlFinal || '').match(/MLB-?(\d{6,})/i);
  if (!m) return null;
  const id = `MLB${m[1]}`;
  for (const ep of [`items/${id}`, `products/${id}`]) {
    try {
      const r = await fetchImpl(`https://api.mercadolibre.com/${ep}`, { signal: AbortSignal.timeout(15000) });
      if (!r.ok) continue;
      const j = await r.json();
      const foto = (j.pictures && j.pictures[0] && (j.pictures[0].secure_url || j.pictures[0].url)) || '';
      const preco = Number(j.price || (j.buy_box_winner && j.buy_box_winner.price) || 0);
      if (j.title || j.name) return { titulo: String(j.title || j.name).slice(0, 200), imagem: foto.replace(/^http:/, 'https:'), preco, nota: 0 };
    } catch { /* tenta o próximo */ }
  }
  return null;
}

/** Lê título, foto e preço do produto a partir do link. Devolve null se a loja não deixar ler. */
async function lerProduto(url, { fetchImpl = (...a) => fetch(...a) } = {}) {
  let final = url;
  try {
    const r = await fetchImpl(url, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36', 'Accept-Language': 'pt-BR' },
      signal: AbortSignal.timeout(20000),
    });
    final = r.url || url;
    if (r.ok) {
      const p = lerHtmlProduto(await r.text());
      if (p) return p;
    }
  } catch { /* tenta a API */ }
  return lojaDe(url) === 'mercadolivre' ? lerMercadoLivreApi(final, fetchImpl) : null;
}

module.exports = { lojaDe, prepararLink, lerHtmlProduto, lerProduto };
