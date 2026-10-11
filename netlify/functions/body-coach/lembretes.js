'use strict';

// NEXIA Body Coach — lembretes no celular pelo robô de 5 em 5 minutos (cron grátis do Cloudflare):
// hora do treino (só se ainda não treinou hoje) e beber água. Lê só quem tem lembrete neste horário.

const { avisar, prefsLimpas, horariosDe, slot } = require('./push');

const agoraBR = (t) => new Date(t - 3 * 3600000);
const diaBR = (t) => agoraBR(t).toISOString().slice(0, 10);

async function rodarLembretes(db, t = Date.now()) {
  const br = agoraBR(t);
  const s = slot(`${String(br.getUTCHours()).padStart(2, '0')}:${String(br.getUTCMinutes()).padStart(2, '0')}`);
  const hoje = diaBR(t);
  const marca = `${hoje} ${s}`;
  const snap = await db.collection('bc_push').where('horarios', 'array-contains', s).limit(300).get();
  let enviados = 0;
  for (const doc of snap.docs) {
    const d = doc.data();
    if (d.ultimoLembrete === marca) continue; // o robô rodou duas vezes no mesmo bloco
    const prefs = prefsLimpas(d.prefs);
    if (!horariosDe(prefs).includes(s)) continue;
    await db.collection('bc_push').doc(doc.id).set({ ultimoLembrete: marca }, { merge: true });
    if (prefs.treino.ativo && slot(prefs.treino.hora) === s) {
      const eu = (await db.collection('bc_diretorio').doc(doc.id).get().catch(() => null))?.data?.() || {};
      const ultimo = Number(eu.ultimoTreino) || 0;
      if (!ultimo || diaBR(ultimo) !== hoje) {
        enviados += await avisar(db, doc.id, { titulo: 'Hora do treino 💪', corpo: 'O seu treino de hoje está pronto. Bora?', url: 'workout', tag: 'treino', urgente: true }, 'treino');
        continue; // não manda água e treino juntos
      }
    }
    if (prefs.agua.ativo && horariosDe({ ...prefs, treino: { ativo: false } }).includes(s)) enviados += await avisar(db, doc.id, { titulo: 'Hora de beber água 💧', corpo: 'Um copo agora. Toque para marcar.', url: 'nutrition', tag: 'agua' }, 'agua');
  }
  return { slot: s, pessoas: snap.docs.length, enviados };
}

module.exports = { rodarLembretes };
