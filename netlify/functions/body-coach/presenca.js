'use strict';
// Presença do aluno: cada treino concluído fica no histórico (últimos 90) para o coach ver quem treinou e qual treino fez.

const MAX = 90;

function registrar(eu, body, agora = Date.now()) {
  const feito = Number(body.feitoEm);
  const em = feito > 0 && feito <= agora && feito > agora - 7 * 86400000 ? feito : agora;
  const titulo = String(body.titulo || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 80) || 'Treino';
  const min = Math.min(300, Math.max(0, Math.round(Number(body.minutos) || 0)));
  const kcal = Math.min(3000, Math.max(0, Math.round(Number(body.kcal) || 0)));
  const antigo = Array.isArray(eu.historico) ? eu.historico : [];
  // o mesmo treino reenviado depois de ficar sem internet não conta duas vezes
  if (antigo.some((h) => h && h.em === em && h.titulo === titulo)) return antigo;
  return [{ em, titulo, min, kcal }, ...antigo].sort((a, b) => b.em - a.em).slice(0, MAX);
}

function ultimos(eu, dias = 60, agora = Date.now()) {
  const lista = Array.isArray(eu.historico) ? eu.historico : [];
  return lista.filter((h) => h && h.em > agora - dias * 86400000).map((h) => ({ em: h.em, titulo: h.titulo, min: h.min, kcal: h.kcal }));
}

module.exports = { registrar, ultimos, MAX };
