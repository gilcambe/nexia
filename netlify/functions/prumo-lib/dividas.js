'use strict';
/**
 * Kernex Finance, fase 9: dívidas e plano de quitação. Todo cálculo vem do motor (motor.js), nunca da IA.
 * Sem dívida cadastrada o sistema NÃO presume que não há dívida: a pessoa pode declarar "não tenho dívidas".
 */
const { totais, compararEstrategias, quitacaoAntecipada, renegociar } = require('./motor');
const fin = require('./financas');
const cartoes = require('./cartoes');

const TIPOS = { cartao: 'Cartão de crédito', emprestimo: 'Empréstimo', financiamento: 'Financiamento', cheque_especial: 'Cheque especial', parcelamento: 'Parcelamento', outro: 'Outra dívida' };
const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const dinheiro = (n) => Math.round(n * 100) / 100;
const numero = (v) => {
  if (typeof v === 'number') return v;
  let t = String(v == null ? '' : v).replace(/[^\d.,-]/g, '');
  if (!t || t === '-') return NaN;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  return Number(t);
};

function validarDivida(o) {
  const credor = texto(o && o.credor, 60);
  if (!credor) return { ok: false, erro: 'Diga com quem é a dívida (banco, loja, pessoa).' };
  const tipo = o.tipo || 'outro';
  if (!TIPOS[tipo]) return { ok: false, erro: 'Tipo de dívida inválido.' };
  const saldo = numero(o.saldo);
  if (!Number.isFinite(saldo) || saldo <= 0) return { ok: false, erro: 'O saldo devedor precisa ser maior que zero.' };
  const juros = o.juros_mes === undefined || o.juros_mes === '' ? 0 : numero(o.juros_mes);
  if (!Number.isFinite(juros) || juros < 0 || juros > 30) return { ok: false, erro: 'Os juros por mês vão de 0 a 30 (%).' };
  const parcela = o.parcela === undefined || o.parcela === '' ? 0 : numero(o.parcela);
  if (!Number.isFinite(parcela) || parcela < 0) return { ok: false, erro: 'A parcela mensal não pode ser negativa.' };
  const item = { credor, tipo, saldo: dinheiro(saldo), juros_mes: dinheiro(juros), parcela: dinheiro(parcela) };
  if (o.cet_ano !== undefined && o.cet_ano !== '') { const c = numero(o.cet_ano); if (!Number.isFinite(c) || c < 0) return { ok: false, erro: 'O CET por ano precisa ser um número igual ou maior que zero.' }; item.cet_ano = dinheiro(c); }
  const dia = Number(o.dia_vencimento);
  if (o.dia_vencimento !== undefined && o.dia_vencimento !== '') { if (!Number.isInteger(dia) || dia < 1 || dia > 31) return { ok: false, erro: 'O dia de vencimento vai de 1 a 31.' }; item.dia_vencimento = dia; }
  const obs = texto(o.observacao, 200); if (obs) item.observacao = obs;
  return { ok: true, item };
}

/** Resumo das dívidas para o Início e a nota de saúde. registradas=false e sem=false => lacuna (não sabemos). */
function resumoDividas(dividas, sem, receitaMes) {
  const lista = dividas || [];
  const total = lista.reduce((s, x) => s + Math.round(x.saldo * 100), 0) / 100;
  const parcelasMes = lista.reduce((s, x) => s + Math.round((x.parcela || 0) * 100), 0) / 100;
  const jurosMes = lista.reduce((s, x) => s + Math.round(((x.saldo * (x.juros_mes || 0)) / 100) * 100), 0) / 100;
  return { registradas: lista.length > 0, sem: !!sem && lista.length === 0, total, parcelas_mes: parcelasMes, juros_mes_estimado: jurosMes, comprometimento_pct: receitaMes > 0 ? Math.round((parcelasMes / receitaMes) * 1000) / 10 : null };
}

/** Risco de liquidez do plano: o extra cabe no que sobra por mês? o valor à vista deixa quantos meses de reserva? */
function riscoLiquidez({ extra, aVista, economiaMensal, saldo, despesaMedia }) {
  const avisos = []; let nivel = 'baixo';
  const sobe = (n, t) => { if (['baixo', 'médio', 'alto'].indexOf(n) > ['baixo', 'médio', 'alto'].indexOf(nivel)) nivel = n; avisos.push(t); };
  if (extra > 0) {
    if (economiaMensal === null) sobe('médio', 'Não sei quanto sobra por mês (envie receitas e gastos), então não consigo dizer se o extra cabe.');
    else if (extra > economiaMensal) sobe('alto', `O extra de R$ ${extra.toFixed(2).replace('.', ',')} por mês é maior que o que sobra hoje (R$ ${Math.max(0, economiaMensal).toFixed(2).replace('.', ',')}).`);
  }
  if (aVista > 0) {
    if (saldo === null) sobe('médio', 'Não sei seu saldo (cadastre suas contas), então não consigo dizer se o valor à vista cabe.');
    else if (aVista > saldo) sobe('alto', `O valor à vista é maior que seu saldo disponível (R$ ${saldo.toFixed(2).replace('.', ',')}).`);
    else if (despesaMedia) {
      const meses = (saldo - aVista) / despesaMedia;
      if (meses < 1) sobe('alto', `Depois de pagar à vista sua reserva cairia para ${meses.toFixed(1).replace('.', ',')} mês de despesas.`);
      else if (meses < 3) sobe('médio', `Depois de pagar à vista sua reserva cairia para ${meses.toFixed(1).replace('.', ',')} meses de despesas (o mínimo costuma ser 3).`);
    }
  }
  return { nivel, avisos };
}

async function agirDividas(acao, body, c) {
  if (!['divida_salvar', 'divida_listar', 'divida_apagar', 'divida_nenhuma', 'divida_plano', 'divida_renegociar'].includes(acao)) return null;
  const { base, listar, salvar, apagar, agoraIso } = c;
  const lerSem = async () => { const s = await base.collection('config').doc('dividas').get(); return !!(s && s.exists && s.data().sem_dividas); };
  switch (acao) {
    case 'divida_salvar': { const r = await salvar('dividas', validarDivida(body)); if (r[0] === 200) await base.collection('config').doc('dividas').set({ sem_dividas: false, atualizado_em: agoraIso }); return r; }
    case 'divida_apagar': return apagar('dividas');
    case 'divida_nenhuma': { const v = body.sem !== false; await base.collection('config').doc('dividas').set({ sem_dividas: v, atualizado_em: agoraIso }); return [200, { ok: true, sem_dividas: v }]; }
    case 'divida_listar': {
      const lista = (await listar(base.collection('dividas'))).sort((a, b) => (b.juros_mes || 0) - (a.juros_mes || 0));
      return [200, { dividas: lista, sem_dividas: lista.length ? false : await lerSem(), resumo: resumoDividas(lista, await lerSem(), null), tipos: TIPOS }];
    }
    case 'divida_plano': {
      const lista = await listar(base.collection('dividas'));
      if (!lista.length) return [200, { sem_dividas: true, mensagem: 'Nenhuma dívida cadastrada.' }];
      const extra = body.extra === undefined || body.extra === '' ? 0 : numero(body.extra);
      const aVista = body.a_vista === undefined || body.a_vista === '' ? 0 : numero(body.a_vista);
      if (!Number.isFinite(extra) || extra < 0 || extra > 1e7 || !Number.isFinite(aVista) || aVista < 0 || aVista > 1e8) return [400, { error: 'Extra e valor à vista precisam ser números iguais ou maiores que zero.' }];
      const mes = agoraIso.slice(0, 7);
      const [lancs, contas] = await Promise.all([listar(base.collection('lancamentos')), listar(base.collection('contas'))]);
      const t = totais(lancs.filter((x) => String(x.data).startsWith(mes)));
      const economia = t.receitas > 0 ? dinheiro(t.receitas - t.despesas) : null;
      const vals = []; for (let i = 1; i <= 3; i++) { const d = totais(lancs.filter((x) => String(x.data).startsWith(cartoes.somarMes(mes, -i)))).despesas; if (d > 0) vals.push(d); }
      if (t.despesas > 0) vals.push(t.despesas);
      const despesaMedia = vals.length ? dinheiro(vals.reduce((s, v) => s + v, 0) / vals.length) : null;
      const comp = compararEstrategias(lista, extra);
      return [200, { extra, estrategias: comp, quitacao_antecipada: aVista > 0 ? quitacaoAntecipada(lista, aVista, extra) : null,
        risco_liquidez: riscoLiquidez({ extra, aVista, economiaMensal: economia, saldo: fin.saldoDisponivel(contas).saldo, despesaMedia }),
        aviso: 'Simulação com os juros e parcelas que você informou. Juros reais do contrato podem variar; confira com o credor.' }];
    }
    case 'divida_renegociar': {
      const d = (await listar(base.collection('dividas'))).find((x) => x.id === texto(body.id, 60));
      if (!d) return [400, { error: 'Escolha a dívida.' }];
      const taxa = numero(body.nova_taxa_mes); const prazo = Number(body.prazo_meses); const fixa = body.taxa_fixa === undefined || body.taxa_fixa === '' ? 0 : numero(body.taxa_fixa);
      if (!Number.isFinite(taxa) || taxa < 0 || taxa > 30) return [400, { error: 'A nova taxa por mês vai de 0 a 30 (%).' }];
      if (!Number.isInteger(prazo) || prazo < 1 || prazo > 480) return [400, { error: 'O prazo vai de 1 a 480 meses.' }];
      if (!Number.isFinite(fixa) || fixa < 0) return [400, { error: 'As taxas da proposta não podem ser negativas.' }];
      return [200, { credor: d.credor, ...renegociar({ saldo: d.saldo, parcela_atual: d.parcela || 0, juros_mes_atual: d.juros_mes || 0, nova_taxa_mes: taxa, prazo_meses: prazo, taxa_fixa: fixa }),
        aviso: 'Compare o CET total da proposta com o do contrato atual antes de aceitar. Nada é contratado por aqui.' }];
    }
    default: return null;
  }
}

module.exports = { agirDividas, validarDivida, resumoDividas, riscoLiquidez, TIPOS };
