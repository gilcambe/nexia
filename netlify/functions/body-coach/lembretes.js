'use strict';

// NEXIA Body Coach — lembretes no celular pelo robô de 5 em 5 minutos (cron grátis do Cloudflare):
// hora do treino (só se ainda não treinou hoje) e beber água. Lê só quem tem lembrete neste horário.

const { avisar, prefsLimpas, horariosDe, slot } = require('./push');
const { rodarCobrancas } = require('./negocio');

// Teste grátis/plano acabando: aviso no celular 3 dias antes e 1 dia antes (às 09:00).
async function avisarFimDoAcesso(db, t) {
  let enviados = 0;
  for (const [falta, quando] of [[3, 'em 3 dias'], [1, 'amanhã']]) {
    const snap = await db.collection('bc_acesso').where('fimDia', '==', diaBR(t + falta * 86400000)).limit(300).get();
    for (const d of snap.docs) {
      if (d.data().isento) continue;
      enviados += await avisar(db, d.id, { titulo: `Seu acesso acaba ${quando}`, corpo: 'Toque para ver como continuar usando o Body Coach.', url: 'acesso', tag: 'acesso' }, 'acesso');
    }
  }
  return enviados;
}

const agoraBR = (t) => new Date(t - 3 * 3600000);
const diaBR = (t) => agoraBR(t).toISOString().slice(0, 10);

async function rodarLembretes(db, t = Date.now()) {
  const br = agoraBR(t);
  const s = slot(`${String(br.getUTCHours()).padStart(2, '0')}:${String(br.getUTCMinutes()).padStart(2, '0')}`);
  const hoje = diaBR(t);
  const marca = `${hoje} ${s}`;
  // Mensalidade: uma vez por dia, às 09:00 de Brasília.
  const cobrancas = s === '09:00' ? await rodarCobrancas(db, t).catch((e) => ({ erro: e.message })) : undefined;
  const fimDoAcesso = s === '09:00' ? await avisarFimDoAcesso(db, t).catch((e) => ({ erro: e.message })) : undefined;
  const volta = s === '18:00' ? await require('./voltar').avisarQuemSumiu(db, t).catch((e) => ({ erro: e.message })) : undefined;
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
  return { slot: s, pessoas: snap.docs.length, enviados, cobrancas, fimDoAcesso, volta };
}

module.exports = { rodarLembretes, avisarFimDoAcesso };
