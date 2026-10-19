// Central NEXIA: 1 amostra de saúde por hora (status e tempo de cada rota pública), guardada 30 dias.
// O cron bate de 5 em 5 min; só mede na 1ª batida de cada hora. Banco carregado só na hora (depois
// do populateProcessEnv), como em lembretes.js.
async function rodar(at) {
  if (new Date(at).getUTCMinutes() >= 5) return { skipped: 'fora da 1ª batida da hora' };
  const h = require('../netlify/functions/central/saude-historico.js');
  const { medir } = require('../netlify/functions/central.js');
  return h.guardarAmostra(h.abrirBanco(process.env), { at, medir: (url) => medir(url, (...a) => fetch(...a)) });
}

module.exports = { rodar };
