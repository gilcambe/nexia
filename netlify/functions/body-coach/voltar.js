'use strict';

// NEXIA Body Coach — aviso de volta: quem está de 3 a 30 dias sem treinar recebe um empurrão às 18:00
// (no máximo 1 aviso a cada 3 dias). Chamado por rodarLembretes (lembretes.js).

const push = require('./push');

const DIA = 86400000;
const diaBR = (t) => new Date(t - 3 * 3600000).toISOString().slice(0, 10);
const diasEntre = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / DIA);

async function avisarQuemSumiu(db, t = Date.now()) {
  const hoje = diaBR(t);
  const snap = await db.collection('bc_push').limit(500).get();
  let avisados = 0;
  for (const doc of snap.docs) {
    const d = doc.data() || {};
    if (d.ultimoAvisoVolta && diasEntre(d.ultimoAvisoVolta, hoje) <= 3) continue;
    const eu = (await db.collection('bc_diretorio').doc(doc.id).get().catch(() => null))?.data?.() || {};
    const ultimo = Number(eu.ultimoTreino) || 0;
    if (!ultimo) continue;
    const dias = diasEntre(diaBR(ultimo), hoje);
    if (dias < 3 || dias > 30) continue;
    const ok = await push.avisar(db, doc.id, {
      titulo: 'Sentimos sua falta 💪',
      corpo: `Faz ${dias} dias do seu último treino. Um treino curto de 20 minutos hoje?`,
      url: 'workout',
      tag: 'volta',
    }, 'volta').catch(() => 0);
    if (ok > 0) {
      await db.collection('bc_push').doc(doc.id).set({ ultimoAvisoVolta: hoje }, { merge: true });
      avisados++;
    }
  }
  return avisados;
}

module.exports = { avisarQuemSumiu };
