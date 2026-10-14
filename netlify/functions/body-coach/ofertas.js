'use strict';

// NEXIA Body Coach — "Ofertas do dia" da Loja: lê as ofertas que o robô de afiliados publica
// (links já com o código de afiliado do dono). Só produtos de treino: o que vier de outra categoria é descartado.

const URL_OFERTAS = 'https://achados-nexia.pages.dev/ofertas.json';
const CATEGORIAS = ['suplementos', 'roupas', 'acessorios', 'em-casa', 'relogios', 'fones'];
const MAXIMO = 60;
const UMA_HORA = 3600000;

let cache = null; // { em, valor }

const https = (u) => typeof u === 'string' && /^https:\/\//i.test(u) ? u.slice(0, 1000) : '';
const numero = (n) => (Number.isFinite(Number(n)) && Number(n) > 0 ? Number(n) : null);

function limparOfertas(json) {
  const lista = Array.isArray(json && json.ofertas) ? json.ofertas : [];
  const porCategoria = Object.fromEntries(CATEGORIAS.map((c) => [c, []]));
  for (const o of lista) {
    if (!o || !CATEGORIAS.includes(o.categoria)) continue;
    const link = https(o.link);
    const titulo = String(o.titulo || '').trim().slice(0, 160);
    if (!link || !titulo) continue;
    porCategoria[o.categoria].push({
      id: String(o.id || link).slice(0, 120),
      loja: String(o.loja || '').slice(0, 40),
      titulo,
      preco: numero(o.preco),
      preco_antigo: numero(o.preco_antigo),
      desconto: numero(o.desconto) ? Math.round(Number(o.desconto)) : 0,
      imagem: https(o.imagem),
      link,
      categoria: o.categoria,
    });
  }
  // Intercala as categorias para toda aba ter ofertas, até 60 no total.
  const ofertas = [];
  for (let i = 0; ofertas.length < MAXIMO && CATEGORIAS.some((c) => porCategoria[c][i]); i++) {
    for (const c of CATEGORIAS) if (porCategoria[c][i] && ofertas.length < MAXIMO) ofertas.push(porCategoria[c][i]);
  }
  const atualizado = typeof (json && json.atualizado) === 'string' ? json.atualizado.slice(0, 40) : null;
  return { atualizado, ofertas };
}

async function lojaOfertas({ agora = Date.now(), buscar = globalThis.fetch } = {}) {
  if (cache && agora - cache.em < UMA_HORA) return cache.valor;
  let valor;
  try {
    const r = await buscar(URL_OFERTAS, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    valor = limparOfertas(await r.json());
  } catch {
    return { ofertas: [] }; // sem cache: tenta de novo no próximo pedido
  }
  cache = { em: agora, valor };
  return valor;
}

const _limparCache = () => { cache = null; };

module.exports = { lojaOfertas, limparOfertas, CATEGORIAS, URL_OFERTAS, _limparCache };
