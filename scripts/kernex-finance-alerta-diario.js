'use strict';
/**
 * Kernex Finance: rotina de alerta diário por e-mail.
 * Percorre os usuários em prumo_users, verifica quem tem config/alertas com
 * canais.email === true e email_para preenchido, e dispara alertas_enviar_email para cada um.
 */
const p = require('../netlify/functions/prumo');
const { mesclar } = require('../netlify/functions/prumo-lib/alertas');

async function listarDestinatarios(db) {
  if (!db || typeof db.collection !== 'function') return [];
  const snapshot = await db.collection('prumo_users').get();
  const uids = [];
  if (!snapshot || !snapshot.docs) return uids;
  for (const doc of snapshot.docs) {
    const uid = doc.id;
    const cfgDoc = await db.collection('prumo_users').doc(uid).collection('config').doc('alertas').get();
    if (!cfgDoc || !cfgDoc.exists) continue;
    const cfg = mesclar(cfgDoc.data());
    if (cfg.canais && cfg.canais.email === true && cfg.email_para) {
      uids.push({ uid, email: cfg.email_para });
    }
  }
  return uids;
}

async function executarAlertaDiario(deps = {}) {
  const brevoKey = deps.BREVO_API_KEY || process.env.BREVO_API_KEY;
  const emailKey = deps.EMAIL_API_KEY || process.env.EMAIL_API_KEY;
  if (!brevoKey && !emailKey) {
    console.log('sem segredo, pulei');
    return { status: 'sem_segredo', enviados: 0 };
  }

  const temFb = !!(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || process.env.FIREBASE_SERVICE_ACCOUNT || (deps.db && typeof deps.db === 'function'));
  if (!temFb) {
    console.log('sem credencial do banco, pulei');
    return { status: 'sem_banco', enviados: 0 };
  }

  const db = (deps.db && typeof deps.db === 'function') ? deps.db() : p.deps.db();
  const destinatarios = await listarDestinatarios(db);
  console.log(`Encontrados ${destinatarios.length} usuário(s) com alerta por e-mail ativo.`);

  let totalEnviados = 0;
  for (const { uid } of destinatarios) {
    try {
      const [code, res] = await p.agir(uid, { acao: 'alertas_enviar_email' });
      if (code === 200 && res && res.enviados) {
        totalEnviados += res.enviados;
      }
    } catch (err) {
      console.warn(`Erro ao enviar alerta para ${uid}:`, err && err.message ? err.message : err);
    }
  }

  console.log(`Alerta diário por e-mail finalizado. Total de alertas enviados: ${totalEnviados}.`);
  return { status: 'ok', destinatarios: destinatarios.length, enviados: totalEnviados };
}

if (require.main === module) {
  executarAlertaDiario().catch((err) => {
    console.error('Falha na execução do alerta diário:', err && err.message ? err.message : err);
    process.exit(1);
  });
}

module.exports = { listarDestinatarios, executarAlertaDiario };
