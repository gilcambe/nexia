'use strict';
// #2857 (parte 5 de #2729): card "Tokens próprios" da Central Kernex. Lê do D1 grátis o que os jobs salvam:
// cache exato (ia_cota/cache), cache semântico (ia_cota/cache_semantico) e uso de hoje por IA (ia_cota/uso).
const DOCS = ['ia_cota/cache', 'ia_cota/cache_semantico', 'ia_cota/uso'];

function montar(docs, hoje = new Date().toISOString().slice(0, 10)) {
  const f = (p) => (docs.get(p) && docs.get(p).fields) || {};
  const cache = f('ia_cota/cache'); const sem = f('ia_cota/cache_semantico'); const uso = f('ia_cota/uso').uso || {};
  const usoHoje = Object.entries(uso)
    .filter(([k]) => k.slice(k.lastIndexOf(':') + 1) === hoje)
    .map(([k, v]) => ({ provedor: k.slice(0, k.lastIndexOf(':')), pedidos: Number(v.requests) || 0, tokens: Number(v.tokens) || 0, semCota: Number(v.errors) || 0 }))
    .sort((a, b) => b.tokens - a.tokens);
  return {
    configurado: true,
    cache: { guardadas: Object.keys(cache.itens || {}).length, acertos: Number(cache.acertos) || 0, economiaTokens: Number(cache.economiaTokens) || 0 },
    semantico: { guardadas: Array.isArray(sem.itens) ? sem.itens.length : 0, acertos: Number(sem.acertos) || 0 },
    usoHoje,
    totalHoje: usoHoje.reduce((s, x) => ({ pedidos: s.pedidos + x.pedidos, tokens: s.tokens + x.tokens }), { pedidos: 0, tokens: 0 }),
  };
}

async function buscar(env = process.env, o = {}) {
  let d = o.driver;
  if (!d) {
    if (!env.NEXIA_D1_TOKEN || !env.NEXIA_D1_ACCOUNT_ID) return { configurado: false };
    d = require('../../../lib/firebase-lite/d1-backend').createD1Driver({ token: env.NEXIA_D1_TOKEN, accountId: env.NEXIA_D1_ACCOUNT_ID });
  }
  return montar(await d.get(DOCS), o.hoje);
}

module.exports = { montar, buscar, DOCS };
