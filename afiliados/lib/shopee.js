'use strict';
// Cliente da API oficial de afiliados da Shopee Brasil (Open API, GraphQL).
// Assinatura: SHA256(AppId + Timestamp + corpo + Senha), no cabeçalho
// "SHA256 Credential=<AppId>, Timestamp=<ts>, Signature=<hex>". O corpo assinado é exatamente o enviado.
const crypto = require('node:crypto');

const URL_API = 'https://open-api.affiliate.shopee.com.br/graphql';
const CAMPOS = ['itemId', 'productName', 'commissionRate', 'commission', 'sales', 'priceMin', 'priceMax',
  'priceDiscountRate', 'ratingStar', 'imageUrl', 'shopName', 'productLink', 'offerLink', 'productCatIds'];

class ShopeeErro extends Error {
  constructor(msg, codigo) { super(msg); this.codigo = codigo; }
}

function assinar(appId, segredo, corpo, ts) {
  const sig = crypto.createHash('sha256').update(`${appId}${ts}${corpo}${segredo}`).digest('hex');
  return `SHA256 Credential=${appId}, Timestamp=${ts}, Signature=${sig}`;
}

/** Valor de argumento GraphQL: texto entre aspas (JSON escapa igual ao GraphQL), número e booleano como estão. */
function arg(v) {
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v === 'boolean') return String(v);
  throw new TypeError('argumento GraphQL inválido');
}
function args(obj) {
  return Object.entries(obj).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => `${k}: ${arg(v)}`).join(', ');
}

function criarShopee({ appId, segredo, fetchImpl = (...a) => fetch(...a), agora = () => Date.now() } = {}) {
  if (!appId || !segredo) throw new ShopeeErro('Faltam SHOPEE_APP_ID e SHOPEE_SECRET', 'SEM_CHAVE');

  async function chamar(query, nome) {
    const corpo = JSON.stringify({ query });
    const ts = Math.floor(agora() / 1000);
    const r = await fetchImpl(URL_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: assinar(appId, segredo, corpo, ts) },
      body: corpo,
      signal: AbortSignal.timeout(30000),
    });
    let j;
    try { j = await r.json(); } catch { throw new ShopeeErro(`Shopee respondeu ${r.status} sem JSON`, 'RESPOSTA'); }
    if (j && Array.isArray(j.errors) && j.errors.length) {
      const e = j.errors[0];
      throw new ShopeeErro(`Shopee: ${e.message || 'erro'}`, (e.extensions && e.extensions.code) || 'ERRO');
    }
    if (!r.ok || !j || !j.data || !j.data[nome]) throw new ShopeeErro(`Shopee respondeu ${r.status}`, 'RESPOSTA');
    return j.data[nome];
  }

  /** Busca produtos com oferta de afiliado. sortType 2 = mais vendidos; 5 = maior comissão. */
  async function buscar({ palavra, ordem = 2, pagina = 1, limite = 20 } = {}) {
    const q = `{ productOfferV2(${args({ keyword: palavra, sortType: ordem, page: pagina, limit: limite })}) { nodes { ${CAMPOS.join(' ')} } pageInfo { page limit hasNextPage } } }`;
    const d = await chamar(q, 'productOfferV2');
    return (d.nodes || []).map(normalizar).filter(Boolean);
  }

  /** Um produto pelo número dele (para links da Shopee colados à mão). */
  async function porItem(itemId) {
    const q = `{ productOfferV2(${args({ itemId: Number(itemId), page: 1, limit: 1 })}) { nodes { ${CAMPOS.join(' ')} } } }`;
    const d = await chamar(q, 'productOfferV2');
    return (d.nodes || []).map(normalizar).filter(Boolean)[0] || null;
  }

  /** Link curto de afiliado para qualquer endereço da Shopee (subId identifica o canal nos relatórios). */
  async function linkCurto(url, subId) {
    const input = `{ originUrl: ${arg(url)}${subId ? `, subIds: [${arg(subId)}]` : ''} }`;
    const d = await chamar(`mutation { generateShortLink(input: ${input}) { shortLink } }`, 'generateShortLink');
    return d.shortLink;
  }

  return { buscar, porItem, linkCurto };
}

const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/** Número do produto num link da Shopee (".../nome-i.123.456" ou "/product/123/456"). */
function itemDoLink(url) {
  const m = String(url).match(/-i\.\d+\.(\d+)/) || String(url).match(/\/product\/\d+\/(\d+)/);
  return m ? m[1] : null;
}

function normalizar(n) {
  if (!n || !n.itemId || !n.productName || !n.offerLink) return null;
  const preco = num(n.priceMin);
  const desconto = num(n.priceDiscountRate);
  return {
    id: `shopee-${n.itemId}`,
    loja: 'shopee',
    titulo: String(n.productName).trim(),
    preco,
    preco_antigo: desconto > 0 && desconto < 100 ? Math.round((preco / (1 - desconto / 100)) * 100) / 100 : null,
    desconto,
    nota: num(n.ratingStar),
    vendas: num(n.sales),
    comissao: num(n.commissionRate),
    imagem: n.imageUrl || '',
    vendedor: n.shopName || '',
    link: n.offerLink,
    link_produto: n.productLink || '',
  };
}

module.exports = { criarShopee, assinar, normalizar, itemDoLink, ShopeeErro, URL_API };
