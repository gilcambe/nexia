'use strict';

// NEXIA Body Coach — prêmio de indicação: quando quem foi indicado paga o Premium (o admin libera com valor > 0),
// quem indicou ganha 1 mês grátis. Uma vez só por pagante. Chamado por acesso.js (acesso_liberar).
// profile/main.indicado_por guarda os 10 primeiros caracteres do uid de quem indicou.

const { avisar } = require('./push');

const PREMIO_DIAS = 30;

function idDoDocumento() {
  try { return require('firebase-admin').firestore.FieldPath.documentId(); } catch { return '__name__'; }
}

async function premiarIndicacao(db, uidPagante, liberarAcesso) {
  const perfilRef = db.collection('bodycoach_users').doc(uidPagante).collection('profile').doc('main');
  const perfil = (await perfilRef.get()).data?.() || {};
  const cod = typeof perfil.indicado_por === 'string' ? perfil.indicado_por.trim().slice(0, 40) : '';
  if (!cod || perfil.indicacao_premiada === true) return false;
  const dir = db.collection('bc_diretorio');
  const snap = await dir.orderBy(idDoDocumento()).startAt(cod).endAt(`${cod}`).limit(1).get();
  const doc = snap.docs && snap.docs[0];
  if (!doc || doc.id === uidPagante || !doc.id.startsWith(cod)) return false;
  // marca antes de dar o prêmio: se algo falhar no meio, nunca premia duas vezes
  await perfilRef.set({ indicacao_premiada: true }, { merge: true });
  await liberarAcesso(db, doc.id, PREMIO_DIAS, Date.now(), { valor: 0 });
  const atual = (await dir.doc(doc.id).get()).data?.() || {};
  await dir.doc(doc.id).set({ indicacoesPagas: (Number(atual.indicacoesPagas) || 0) + 1 }, { merge: true });
  await avisar(db, doc.id, { titulo: 'NEXIA Body Coach', corpo: '🎁 Você ganhou 1 mês de Premium! Um amigo que você indicou assinou.', url: '', tag: 'indicacao' }, 'indicacao').catch(() => 0);
  return true;
}

module.exports = { premiarIndicacao, PREMIO_DIAS };
