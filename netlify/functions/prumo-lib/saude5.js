'use strict';
// Redesign do Finance (fase 1): funções puras do score de saúde (5 pilares) e dos números do mês. Contrato: tests/contrato/finance-saude5.test.js.
const r1 = (n) => Math.round(n * 10) / 10;
const r2 = (n) => Math.round(n * 100) / 100;
const br = (n) => String(r1(Number(n) || 0)).replace('.', ',');
const temN = (v) => v !== null && v !== undefined && Number.isFinite(Number(v));
function faixa(t) { if (t == null) return 'sem_dados'; if (t < 40) return 'critico'; if (t < 60) return 'atencao'; if (t < 80) return 'tranquilo'; return 'excelente'; }
function scoreSaude(p = {}) {
  const pil = [];
  const add = (id, nome, peso, pontos, medido, dica) => pil.push({ id, nome, peso, pontos: pontos == null ? null : r1(pontos), estado: pontos == null ? 'sem_dados' : 'ok', medido: pontos == null ? null : medido, dica: pontos != null && r1(pontos) < peso ? dica : null });
  const fl = temN(p.renda) && p.renda > 0 && temN(p.sobra) ? Math.min(1, Math.max(0, p.sobra / p.renda) / 0.2) * 25 : null;
  add('fluxo', 'Fluxo do mês', 25, fl, fl == null ? null : `Sobra ${Math.round((p.sobra / p.renda) * 100)}% da renda`, 'Guarde pelo menos 20% da renda no mês.');
  const re = temN(p.reserva_meses) ? Math.min(1, p.reserva_meses / 6) * 25 : null;
  add('reserva', 'Reserva', 25, re, `${br(p.reserva_meses)} meses de 6`, 'Complete 6 meses de gastos guardados.');
  let dv = null;
  if (p.rotativo === true) dv = 0; else if (temN(p.divida_renda_pct)) { const x = Number(p.divida_renda_pct); dv = x <= 30 ? 20 : x >= 60 ? 0 : (20 * (60 - x)) / 30; }
  add('dividas', 'Dívidas', 20, dv, p.rotativo ? 'Rotativo ou cheque especial ativo' : `Parcelas ${br(p.divida_renda_pct)}% da renda`, p.rotativo ? 'Quite o rotativo ou o cheque especial primeiro.' : 'Deixe as parcelas em até 30% da renda.');
  const fu = temN(p.investe_pct) ? Math.min(1, p.investe_pct / 15) * 20 : null;
  add('futuro', 'Futuro', 20, fu, `Investindo ${br(p.investe_pct)}% da renda`, 'Invista 15% da renda todo mês.');
  const og = temN(p.dias_desde_atualizacao) ? (p.contas_em_dia !== false ? 4 : 0) + (p.dias_desde_atualizacao < 35 ? 4 : 0) + (!p.pontos_vencendo ? 2 : 0) : null;
  add('organizacao', 'Organização', 10, og, (Number(p.dias_desde_atualizacao) === 0 ? 'Atualizado hoje' : `Atualizado há ${p.dias_desde_atualizacao} dia(s)`), 'Mantenha os dados em dia e use os pontos antes de vencer.');
  const com = pil.filter((x) => x.pontos != null);
  const total = com.length ? Math.round((com.reduce((s, x) => s + x.pontos, 0) / com.reduce((s, x) => s + x.peso, 0)) * 100) : null;
  return { total, faixa: faixa(total), estimado: com.length < pil.length, pilares: pil };
}
function diasRestantes(hoje) { const [a, m, d] = String(hoje).slice(0, 10).split('-').map(Number); return new Date(Date.UTC(a, m, 0)).getUTCDate() - d + 1; }
function faltaReceber({ liquido, recebido } = {}) { if (!temN(liquido)) return null; return r2(Math.max(0, Number(liquido) - (Number(recebido) || 0))); }
function kpisMes(p = {}) {
  const tenho = temN(p.tenho) ? Number(p.tenho) : null;
  const dr = Math.max(1, Number(p.dias_restantes) || 1);
  const posso_mes = tenho == null ? null : r2(tenho + (Number(p.falta_receber) || 0) - (Number(p.comprometido) || 0));
  const posso_hoje = posso_mes == null ? null : r2(Math.max(0, posso_mes) / dr);
  const sobra_prevista = posso_mes == null || !temN(p.gasto_diario) ? null : r2(posso_mes - Number(p.gasto_diario) * dr);
  const estado = tenho == null ? 'sem_dados' : !p.comprometido_cadastrado ? 'estimado' : 'completo';
  return { posso_mes, posso_hoje, sobra_prevista, alerta: posso_mes != null && posso_mes < 0, estado, aviso: estado === 'estimado' ? 'Estimado: faltam despesas fixas.' : estado === 'sem_dados' ? 'Cadastre o saldo das suas contas.' : '' };
}
module.exports = { scoreSaude, diasRestantes, faltaReceber, kpisMes };
