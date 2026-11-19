'use strict';
/**
 * Kernex Finance: saldo previsto no fim do mês e quanto posso gastar hoje (melhorias 14 e 17).
 * Exporta fimDoMes(...) e agirFimDoMes(acao, body, c) (ação 'fim_mes_previsao').
 * Chamado por agirExtra (extra.js). Devolve null se a ação não for daqui.
 */

const DATA = /^\d{4}-\d{2}-\d{2}$/;

function ultimoDiaMes(ano, mes) {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

function fimDoMes({ saldo, a_receber, a_pagar, gasto_diario, hoje }) {
  if (saldo === null || saldo === undefined) {
    return { dias_restantes: 0, saldo_fim: null, pode_hoje: null, ate: null };
  }
  const d = new Date(Date.parse(String(hoje).slice(0, 10)));
  const ano = d.getUTCFullYear();
  const mes = d.getUTCMonth() + 1;
  const ultimo = ultimoDiaMes(ano, mes);
  const ate = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`;
  const dias_restantes = Math.max(0, ultimo - d.getUTCDate());
  const receber = Number.isFinite(Number(a_receber)) ? Number(a_receber) : 0;
  const pagar = Number.isFinite(Number(a_pagar)) ? Number(a_pagar) : 0;
  const gasto = Number.isFinite(Number(gasto_diario)) ? Number(gasto_diario) : 0;
  const saldo_fim = Math.round((saldo + receber - pagar - gasto * dias_restantes) * 100) / 100;
  const pode_hoje = Math.max(0, (saldo - pagar) / (dias_restantes + 1));
  return { dias_restantes, saldo_fim, pode_hoje: Math.round(pode_hoje * 100) / 100, ate };
}

async function lerSaldo(base, listar) {
  try {
    const contas = await listar(base.collection('contas'));
    return (Array.isArray(contas) ? contas : [])
      .reduce((s, x) => s + (x && Number.isFinite(Number(x.saldo)) ? Number(x.saldo) : 0), 0);
  } catch { return 0; }
}

async function lerGastoDiario(base, listar, hoje) {
  try {
    const gastos = await listar(base.collection('gastos'));
    const itens = Array.isArray(gastos) ? gastos : [];
    const limite = Date.parse(hoje) - 30 * 86400000;
    const soma = itens.reduce((s, x) => {
      if (!x) return s;
      const v = Number(x.valor);
      const dia = String(x.data || x.dia || '').slice(0, 10);
      if (!Number.isFinite(v) || !DATA.test(dia)) return s;
      if (Date.parse(dia) >= limite && Date.parse(dia) <= Date.parse(hoje)) return s + v;
      return s;
    }, 0);
    return soma / 30;
  } catch { return 0; }
}

async function lerPrevisto(c, mes) {
  try {
    const previsto = require('./previsto');
    const fn = previsto && (previsto.agirPrevisto || previsto.agirFimDoMes);
    if (typeof fn !== 'function') return { a_receber: 0, a_pagar: 0 };
    const r = await fn('resumo_previsto', { mes }, c);
    const d = Array.isArray(r) && r[0] === 200 ? r[1] : r;
    const a_receber = d && d.resumoPrevisto
      ? (Number.isFinite(Number(d.resumoPrevisto.a_receber)) ? Number(d.resumoPrevisto.a_receber) : 0)
      : (d && Number.isFinite(Number(d.a_receber)) ? Number(d.a_receber) : 0);
    const a_pagar = d && d.resumoPrevisto
      ? (Number.isFinite(Number(d.resumoPrevisto.a_pagar)) ? Number(d.resumoPrevisto.a_pagar) : 0)
      : (d && Number.isFinite(Number(d.a_pagar)) ? Number(d.a_pagar) : 0);
    return { a_receber, a_pagar };
  } catch { return { a_receber: 0, a_pagar: 0 }; }
}

async function agirFimDoMes(acao, body, c) {
  if (acao !== 'fim_mes_previsao') return null;
  const { base, listar, agoraIso } = c || {};
  const hoje = (typeof body && typeof body.hoje === 'string' && DATA.test(body.hoje))
    ? body.hoje
    : (agoraIso ? String(agoraIso).slice(0, 10) : new Date().toISOString().slice(0, 10));
  const mes = hoje.slice(0, 7);

  // Leituras em paralelo: saldo (contas), gasto médio (últimos 30 dias) e previsão do mês.
  const [saldo, gasto_diario, previsto] = await Promise.all([
    lerSaldo(base, listar),
    lerGastoDiario(base, listar, hoje),
    lerPrevisto(c, mes)
  ]);

  const r = fimDoMes({ saldo, a_receber: previsto.a_receber, a_pagar: previsto.a_pagar, gasto_diario, hoje });
  return [200, { ...r, hoje, mes, saldo, a_receber: previsto.a_receber, a_pagar: previsto.a_pagar, gasto_diario }];
}

module.exports = { fimDoMes, agirFimDoMes };

