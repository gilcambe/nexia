// Central NEXIA: 1 amostra de saúde por hora (status e tempo de cada rota pública), guardada 30 dias.
// O cron bate de 5 em 5 min; só mede na 1ª batida de cada hora. Banco carregado só na hora (depois
// do populateProcessEnv), como em lembretes.js.
async function rodar(at) {
  if (new Date(at).getUTCMinutes() >= 5) return { skipped: 'fora da 1ª batida da hora' };
  const h = require('../netlify/functions/central/saude-historico.js');
  const { medir } = require('../netlify/functions/central.js');
  const db = h.abrirBanco(process.env);
  const medir10 = criarMedir10(medir);
  const r = await h.guardarAmostra(db, { at, medir: medir10 });
  // Vigia (#1014): 2 falhas seguidas no mesmo endereço → 1 issue cortex-alerta. Nunca derruba a amostra.
  if (r && r.porRota) {
    try {
      const v = require('../netlify/functions/central/vigia-sites.js');
      r.vigia = await v.vigiar(db, { at, porRota: r.porRota, rotas: h.ROTAS, medir: medir10, env: process.env });
    } catch (e) { r.vigia = { erro: e && e.message }; }
    delete r.porRota;
  }
  return r;
}

// #2882: o próprio Worker é medido pelo binding SELF (fetch normal para o próprio workers.dev o Cloudflare barra).
// Nunca lança erro: qualquer problema vira ok:false só daquela rota.
function criarMedir10(medir, { base, self = globalThis.__NEXIA_SELF__, fetchFn = (...a) => fetch(...a) } = {}) {
  const BASE = base || require('../central/produtos.js').BASE;
  const host = (u) => { try { return new URL(u).hostname; } catch { return ''; } };
  return async (url) => {
    try {
      const proprio = host(url) === host(BASE);
      const f = proprio && self && typeof self.fetch === 'function' ? (...a) => self.fetch(...a) : fetchFn;
      return await medir(url, f, 10000); // tempo limite 10 s
    } catch (e) { return { ok: false, codigo: 0, tempo: 0, lento: false }; }
  };
}

module.exports = { rodar, criarMedir10 };
