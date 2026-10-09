'use strict';
// Avaliação semanal das IAs grátis: quem acerta mais é tentado primeiro.
const MIN_EXECUCOES = 3;

/** execucoes: [{ modelo, ok }] → [{ modelo, total, acertos, taxa }] do melhor para o pior (mín. 3 execuções por modelo). */
function avaliarModelos(execucoes) {
  const porModelo = new Map();
  for (const e of Array.isArray(execucoes) ? execucoes : []) {
    if (!e || !e.modelo) continue;
    const m = porModelo.get(e.modelo) || { modelo: e.modelo, total: 0, acertos: 0 };
    m.total += 1;
    if (e.ok) m.acertos += 1;
    porModelo.set(e.modelo, m);
  }
  return [...porModelo.values()]
    .filter(m => m.total >= MIN_EXECUCOES)
    .map(m => ({ ...m, taxa: m.acertos / m.total }))
    .sort((a, b) => b.taxa - a.taxa || b.total - a.total);
}

/** Reordena `modelos` pela taxa da avaliação; sem avaliação ficam no fim, na ordem original. */
function ordemDeTentativa(avaliacao, modelos) {
  const lista = Array.isArray(modelos) ? modelos : [];
  const pos = new Map((Array.isArray(avaliacao) ? avaliacao : []).map((a, i) => [a.modelo, i]));
  const avaliados = lista.filter(m => pos.has(m)).sort((x, y) => pos.get(x) - pos.get(y));
  return [...avaliados, ...lista.filter(m => !pos.has(m))];
}

module.exports = { avaliarModelos, ordemDeTentativa, MIN_EXECUCOES };
