'use strict';
// Kernex Finance: confere robôs no pregão e avisa por e-mail quem ligou o e-mail.
// Roda no GitHub Actions. Sem chave do banco ou do provedor de e-mail: avisa e não finge sucesso.
const { checarTodos } = require('../netlify/functions/prumo-lib/robos.js');
(async () => {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 && !process.env.FIREBASE_SERVICE_ACCOUNT) { console.log('PULEI: falta a chave do banco no GitHub.'); return; }
  const { db } = require('../netlify/functions/firebase-init.js');
  if (!db) { console.log('FALHOU: não há banco de dados.'); process.exit(1); }
  const r = await checarTodos(db, new Date().toISOString());
  console.log(JSON.stringify(r));
  if (r.falhas) { process.exit(1); }
})().catch((e) => { console.log('FALHOU: ' + (e && e.message)); process.exit(1); });
