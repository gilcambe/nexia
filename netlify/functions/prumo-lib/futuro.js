'use strict';
// Redesign fase 5 (plano, tela 6): Patrimônio e Futuro numa leitura só. Ação 'patrimonio_resumo'.
// Total = contas + investimentos + previdência + FGTS - dívidas; composição por classe; reserva (meses cobertos e
// quanto guardar); independência financeira = investido ÷ (gasto mensal × 12 × 25) (regra dos 4%: referência simples);
// INSS pelo CNIS salvo; dívidas por juros, do maior para o menor. Não recomenda produto financeiro.
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const CLASSE = { renda_fixa: 'renda_fixa', tesouro: 'renda_fixa', poupanca: 'renda_fixa', acoes: 'acoes_fiis', fiis: 'acoes_fiis', etf: 'acoes_fiis', fundos: 'acoes_fiis', previdencia: 'previdencia', cripto: 'cripto', fgts: 'fgts' };
const NOME = { conta: 'Conta e dinheiro', renda_fixa: 'Renda fixa', acoes_fiis: 'Ações, FIIs e fundos', previdencia: 'Previdência', cripto: 'Cripto', fgts: 'FGTS', outro: 'Outros' };

function independencia(investido, gastoMensal) {
  if (!(gastoMensal > 0)) return null;
  const alvo = r2(gastoMensal * 12 * 25);
  return { investido: r2(investido), alvo, pct: Math.min(100, Math.round((investido / alvo) * 1000) / 10) };
}

async function agirFuturo(acao, body, c) {
  if (acao !== 'patrimonio_resumo') return null;
  const { base, listar, agoraIso } = c;
  const mes = agoraIso.slice(0, 7);
  const [contas, carteira, dividas, aposDocs, histR, plano] = await Promise.all([
    listar(base.collection('contas')), c.listarCarteira ? c.listarCarteira() : listar(base.collection('carteira')), listar(base.collection('dividas')),
    listar(base.collection('aposentadoria')).catch(() => []), listar(base.collection('historico')).catch(() => []),
    require('./planejamento').carregarPlano(c, mes).catch(() => null),
  ]);
  const comp = { conta: 0, renda_fixa: 0, acoes_fiis: 0, previdencia: 0, cripto: 0, fgts: 0, outro: 0 };
  const sd = require('./financas').saldoDisponivel(contas);
  comp.conta = r2(sd.saldo || 0);
  for (const i of carteira) { const k = CLASSE[i.tipo] || 'outro'; comp[k] = r2(comp[k] + (Number(i.valor) || 0)); }
  const fg = aposDocs.find((x) => x.id === 'fgts');
  if (fg && Number(fg.saldo) > 0 && !carteira.some((i) => i.tipo === 'fgts')) comp.fgts = r2(comp.fgts + Number(fg.saldo));
  const totDiv = r2(dividas.reduce((s, d) => s + (Number(d.saldo) || 0), 0));
  const bruto = r2(Object.values(comp).reduce((s, v) => s + v, 0));
  const composicao = Object.entries(comp).filter(([, v]) => v > 0).map(([k, v]) => ({ id: k, nome: NOME[k], valor: v, pct: bruto > 0 ? Math.round((v / bruto) * 100) : 0 })).sort((a, b) => b.valor - a.valor);
  // variação do mês: o histórico guarda a carteira por dia; compara o último registro deste mês com o do mês anterior
  const hist = histR.slice().sort((a, b) => String(a.data).localeCompare(String(b.data)));
  const ultimoAntes = [...hist].reverse().find((h) => String(h.data).slice(0, 7) < mes);
  const ultimoAgora = [...hist].reverse().find((h) => String(h.data).slice(0, 7) === mes);
  const variacao_investimentos = ultimoAntes && ultimoAgora ? r2(ultimoAgora.total - ultimoAntes.total) : null;
  const investido = r2(comp.renda_fixa + comp.acoes_fiis + comp.previdencia + comp.cripto + comp.outro);
  const rv = plano && plano.reserva;
  const perfil = aposDocs.find((x) => x.id === 'perfil') || null;
  const tc = perfil && Number(perfil.tc_total_meses) > 0 ? Number(perfil.tc_total_meses) : null;
  return [200, {
    total: r2(bruto - totDiv), bruto, dividas_total: totDiv, composicao, variacao_investimentos,
    reserva: rv ? { meses_meta: rv.meses, gasto_mensal: rv.gasto_mensal, guardado: rv.guardado, alvo: rv.alvo, falta: rv.falta, pct: rv.pct, meses_cobertos: rv.gasto_mensal > 0 ? Math.round((rv.guardado / rv.gasto_mensal) * 10) / 10 : null, aporte: rv.aporte || null, meses_para_completar: rv.meses_para_completar || null } : null,
    independencia: independencia(investido, rv && rv.gasto_mensal),
    inss: tc ? { tc_total_meses: tc, anos: Math.floor(tc / 12), meses: tc % 12, nascimento: perfil.nascimento || null, atualizado_em: perfil.atualizado_em || null } : null,
    dividas: dividas.map((d) => ({ id: d.id, credor: d.credor, tipo: d.tipo, saldo: Number(d.saldo) || 0, juros_mes: Number(d.juros_mes) || 0, parcela: Number(d.parcela) || 0, custo_mes: r2(((Number(d.saldo) || 0) * (Number(d.juros_mes) || 0)) / 100) }))
      .sort((a, b) => b.juros_mes - a.juros_mes),
    aviso: 'Não é recomendação de investimento: são os seus números e a sua meta.',
  }];
}

module.exports = { agirFuturo, independencia };
