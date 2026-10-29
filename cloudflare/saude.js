// Central NEXIA: 1 amostra de saúde por hora (status e tempo de cada rota pública), guardada 30 dias.
// O cron bate de 5 em 5 min; só mede na 1ª batida de cada hora. Banco carregado só na hora (depois
// do populateProcessEnv), como em lembretes.js.
async function rodar(at) {
  if (new Date(at).getUTCMinutes() >= 5) return { skipped: 'fora da 1ª batida da hora' };
  const h = require('../netlify/functions/central/saude-historico.js');
  const { medir } = require('../netlify/functions/central.js');
  const db = h.abrirBanco(process.env);
  const medir10 = (url) => {
    const baseHost = new URL(process.env.SELF).hostname;
    const targetHost = new URL(url).hostname;
    if (baseHost === targetHost && process.env.SELF) {
      return medir(url, (...a) => process.env.SELF.fetch(...a), 10000); // tempo limite 10 s
    }
    return medir(url, (...a) => fetch(...a), 10000); // tempo limite 10 s
  };
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

module.exports = { rodar };
