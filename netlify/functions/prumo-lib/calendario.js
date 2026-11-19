'use strict';
/**
 * Kernex Finance: calendário do mês (melhoria 6).
 * calendarioMes({ pagamentos, lancs, dividas, cartoes }, mes) junta salário, contas,
 * dívidas e faturas do mês em itens ordenados por data.
 * Chamado por agirExtra (extra.js) na ação 'calendario_mes'. Devolve null se a ação não for daqui.
 */
const MES = /^\d{4}-\d{2}$/;
const MAX_DIA = 31;

const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const numero = (v) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v.replace(/\./g, '').replace(',', '.')) : NaN);
const dinheiro = (n) => Math.round(Number(n) * 100) / 100;

function diaValido(d) {
  const dn = Number(d);
  return Number.isInteger(dn) && dn >= 1 && dn <= MAX_DIA ? dn : null;
}
function dataDoMes(mes, dia) {
  return `${mes}-${String(dia).padStart(2, '0')}`;
}

// PJ fica fora do calendário do dono.
function isPj(l) {
  return String((l && l.perfil) || '').toLowerCase() === 'pj';
}

function calendarioMes(entradas, mes) {
  if (!MES.test(String(mes || ''))) return [];
  const e = entradas || {};
  const itens = [];

  // pagamentos (data_pagamento no mês) = entrada
  for (const p of Array.isArray(e.pagamentos) ? e.pagamentos : []) {
    const data = String(p && p.data_pagamento || '');
    if (data.slice(0, 7) !== mes) continue;
    const valor = dinheiro(numero(p && p.liquido));
    if (!Number.isFinite(valor)) continue;
    itens.push({
      data: data.slice(0, 10),
      tipo: 'entrada',
      nome: texto(p.tipo || 'Recebimento', 80) || 'Recebimento',
      valor,
      origem: 'pagamento'
    });
  }

  // lançamento receita/despesa do mês = entrada/saída (PJ de fora)
  for (const l of Array.isArray(e.lancs) ? e.lancs : []) {
    if (isPj(l)) continue;
    const data = String(l && l.data || '');
    if (data.slice(0, 7) !== mes) continue;
    const valor = dinheiro(Math.abs(numero(l && l.valor) || 0));
    if (!Number.isFinite(valor) || valor <= 0) continue;
    itens.push({
      data: data.slice(0, 10),
      tipo: String(l.tipo || '') === 'receita' ? 'entrada' : 'saida',
      nome: texto(l.descricao || 'Lançamento', 80) || 'Lançamento',
      valor,
      origem: 'lancamento'
    });
  }

  // dívida com parcela e dia_vencimento = saída no dia
  for (const d of Array.isArray(e.dividas) ? e.dividas : []) {
    const dia = diaValido(d && d.dia_vencimento);
    if (!dia) continue;
    const parcela = dinheiro(numero(d && d.parcela));
    if (!Number.isFinite(parcela) || parcela <= 0) continue;
    itens.push({
      data: dataDoMes(mes, dia),
      tipo: 'saida',
      nome: texto(d.credor || 'Dívida', 80) || 'Dívida',
      valor: parcela,
      origem: 'divida'
    });
  }

  // cartão = saída "Fatura <nome>" no dia_vencimento com fatura_atual (se > 0)
  for (const c of Array.isArray(e.cartoes) ? e.cartoes : []) {
    const dia = diaValido(c && c.dia_vencimento);
    if (!dia) continue;
    const fatura = dinheiro(numero(c && c.fatura_atual));
    if (!Number.isFinite(fatura) || fatura <= 0) continue;
    itens.push({
      data: dataDoMes(mes, dia),
      tipo: 'saida',
      nome: `Fatura ${texto(c.nome || 'cartão', 80) || 'cartão'}`,
      valor: fatura,
      origem: 'cartao'
    });
  }

  itens.sort((a, b) => a.data.localeCompare(b.data) || a.origem.localeCompare(b.origem));
  return itens;
}

function agirCalendario(acao, body, c) {
  if (acao !== 'calendario_mes') return null;
  const mes = texto((body && body.mes) || '', 7);
  if (!MES.test(mes)) return [400, { error: 'Diga o mês (AAAA-MM).' }];
  const entradas = {
    pagamentos: Array.isArray(body && body.pagamentos) ? body.pagamentos : [],
    lancs: Array.isArray(body && body.lancs) ? body.lancs : [],
    dividas: Array.isArray(body && body.dividas) ? body.dividas : [],
    cartoes: Array.isArray(body && body.cartoes) ? body.cartoes : []
  };
  return [200, calendarioMes(entradas, mes)];
}

module.exports = { calendarioMes, agirCalendario };
