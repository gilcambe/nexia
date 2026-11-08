'use strict';
// Kernex Finance: manda o e-mail diário de alertas para quem ligou o e-mail na aba Alertas.
// Roda no GitHub Actions (grátis). Sem chave do banco ou do provedor de e-mail: avisa e não finge sucesso.
const { enviarDiario } = require('../netlify/functions/prumo-lib/alertas.js');
(async () => {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 && !process.env.FIREBASE_SERVICE_ACCOUNT) { console.log('PULEI: falta a chave do banco no GitHub.'); return; }
  if (!process.env.BREVO_API_KEY) { console.log('PULEI: o envio de e-mail não está configurado (BREVO_API_KEY). Nenhum e-mail saiu.'); return; }
  const { db } = require('../netlify/functions/firebase-init.js');
  const r = await enviarDiario(db, new Date().toISOString());
  console.log(`Pessoas com e-mail ligado: ${r.pessoas}. Enviados: ${r.enviados}. Sem alerta hoje: ${r.sem_alerta}. Já enviados hoje: ${r.ja_hoje}. Falhas: ${r.falhas}.`);
  if (r.falhas) { console.log('FALHOU: ' + r.motivo); process.exit(1); }
})().catch((e) => { console.log('FALHOU: ' + (e && e.message)); process.exit(1); });
