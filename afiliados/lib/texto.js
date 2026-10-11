'use strict';
// Textos dos posts. Só modelos fixos, sem IA: o post nunca inventa característica, preço ou promessa
// que a loja não mostrou (regra das lojas e do CONAR). Sempre leva o aviso de publicidade.

const LOJA = { shopee: 'Shopee', mercadolivre: 'Mercado Livre', amazon: 'Amazon' };
/** "na Shopee", "no Mercado Livre", "na Amazon". */
const naLoja = l => ({ shopee: 'na Shopee', mercadolivre: 'no Mercado Livre', amazon: 'na Amazon' }[l] || 'na loja');
const ABERTURAS = ['🔥 Achado do dia', '💥 Oferta boa', '👀 Olha esse preço', '✨ Vale a pena', '🛒 Promoção'];
const AVISO = '#publi Link de afiliado: posso ganhar comissão, sem custo extra para você.';

const reais = v => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const milhar = n => (n >= 1000 ? `${Math.floor(n / 1000)} mil` : String(n));
function horaMin(t) {
  const d = new Date(t - 3 * 3600 * 1000);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}
function encurtar(s, max) {
  s = String(s || '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  const corte = s.slice(0, max - 1);
  return corte.slice(0, corte.lastIndexOf(' ') > max * 0.6 ? corte.lastIndexOf(' ') : corte.length) + '…';
}
/** Escolha estável (mesmo produto, mesma abertura) para não parecer aleatório demais. */
function escolher(lista, chave) {
  let h = 0;
  for (const c of String(chave)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return lista[h % lista.length];
}

function linhaPreco(o) {
  if (!o.preco) return '';
  const antes = o.preco_antigo && o.preco_antigo > o.preco ? ` (antes ${reais(o.preco_antigo)}, -${Math.round(o.desconto)}%)` : '';
  return `💰 ${reais(o.preco)}${antes}`;
}
function linhaProva(o) {
  const p = [];
  if (o.nota) p.push(`⭐ ${o.nota.toFixed(1).replace('.', ',')}`);
  if (o.vendas >= 50) p.push(`${milhar(o.vendas)} vendidos`);
  return p.join(' · ');
}

/**
 * Texto do post para um canal. `curto` (X e Bluesky) cabe em `limite` caracteres, contando o link como `linkConta`
 * (null = tamanho real).
 * O preço sempre leva "conferido às HH:MM", porque o preço da loja muda.
 */
function textoPost(o, { curto = false, quando = Date.now(), link = o.link, limite = 280, linkConta = 23 } = {}) {
  const abertura = escolher(ABERTURAS, o.id);
  if (curto) {
    // X conta todo link como 23 caracteres (limite 280); o Bluesky conta o link inteiro (limite 300).
    const preco = o.preco ? `💰 ${reais(o.preco)}${o.desconto ? ` (-${Math.round(o.desconto)}%)` : ''}` : '';
    const fixo = [preco, link, '#publi link de afiliado'].filter(Boolean);
    const usado = fixo.join('\n').length - link.length + (linkConta == null ? link.length : linkConta) + abertura.length + 3;
    return [`${abertura}: ${encurtar(o.titulo, Math.max(20, limite - usado))}`, ...fixo].join('\n');
  }
  return [
    `${abertura} ${naLoja(o.loja)}!`,
    encurtar(o.titulo, 140),
    linhaPreco(o) && `${linhaPreco(o)} · conferido às ${horaMin(quando)}`,
    linhaProva(o),
    `👉 ${link}`,
  ].filter(Boolean).join('\n') + `\n\n${AVISO}`;
}

module.exports = { textoPost, reais, encurtar, horaMin, AVISO, LOJA, naLoja };
