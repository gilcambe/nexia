// Body Coach: lembretes no celular pelo cron do Worker. O banco é carregado só na hora (depois do
// populateProcessEnv), como em functions.js.
async function rodar(at) {
  const { db } = require('../netlify/functions/firebase-init.js');
  if (!db) return { skipped: 'sem banco' };
  return require('../netlify/functions/body-coach/lembretes.js').rodarLembretes(db, at);
}

async function rodarSplash(at) {
  const { db } = require('../netlify/functions/firebase-init.js');
  if (!db) return { skipped: 'sem banco' };
  return require('../netlify/functions/locacao-lib/lembretes.js').rodar(db, at);
}

module.exports = { rodar, rodarSplash };
