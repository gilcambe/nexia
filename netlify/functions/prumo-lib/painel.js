'use strict';
// Redesign do Finance (fase 1): FONTE ÚNICA dos números da tela Início. Ação 'painel_resumo'.
// Responde em 5 segundos: score 0-100 (5 pilares), Tenho, Recebi, A pagar, "Pode gastar hoje", confiança dos dados,
// até 3 alertas e os últimos lançamentos. Cada número diz o estado (completo | estimado | sem_dados) e de onde veio.
// Cálculos puros em saude5.js (Cortex); aqui só lemos os dados certos do banco.
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const soma = (xs, f) => r2(xs.reduce((s, x) => s + (Number(f(x)) || 0), 0));
const INVEST = /invest|aplica|aporte|previd|tesouro|cdb|poupan/i;

function mesAntes(mes, n) { const [a, m] = mes.split('-').map(Number); const t = a * 12 + (m - 1) - n; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`; }
const dias = (de, ate) => Math.round((Date.parse(ate) - Date.parse(de)) / 86400000);

/** Confiança: quanto do essencial já está cadastrado. Cada item faltando vira um passo do Raio-X. */
function confianca(t) {
  const itens = [
    { id: 'salario', nome: 'Salário', ok: t.salario, nivel: 1, aba: 'salario' },
    { id: 'contas', nome: 'Saldo das contas', ok: t.contas, nivel: 1, aba: 'contas' },
    { id: 'fixas', nome: 'Contas fixas do mês', ok: t.fixas, nivel: 1, aba: 'orcamento' },
    { id: 'cartoes', nome: 'Cartões e faturas', ok: t.cartoes, nivel: 2, aba: 'cartoes' },
    { id: 'dividas', nome: 'Dívidas (ou "não tenho")', ok: t.dividas, nivel: 2, aba: 'dividas' },
    { id: 'investimentos', nome: 'Investimentos', ok: t.investimentos, nivel: 2, aba: 'investimentos' },
    { id: 'gastos', nome: 'Gastos do mês', ok: t.gastos, nivel: 2, aba: 'documentos' },
    { id: 'aposentadoria', nome: 'INSS e FGTS', ok: t.aposentadoria, nivel: 2, aba: 'aposentadoria' },
  ];
  const feitos = itens.filter((x) => x.ok).length;
  return { pct: Math.round((feitos / itens.length) * 100), feitos, total: itens.length, faltam: itens.filter((x) => !x.ok).map(({ ok, ...x }) => x) };
}

async function montarPainel(c) {
  const { base, listar, agoraIso } = c;
  const S = require('./saude5');
  const prv = require('./previsto');
  const hoje = prv.hojeDe(agoraIso);
  const mes = hoje.slice(0, 7);
  const [lancsTodos, contas, pagamentos, dividas, cartoes, gastos, carteira, pontos, scores, apos, orcS, cfgDiv, cfgSal, histS, sp] = await Promise.all([
    listar(base.collection('lancamentos')), listar(base.collection('contas')), listar(base.collection('pagamentos')),
    listar(base.collection('dividas')), listar(base.collection('cartoes')), listar(base.collection('gastos')),
    listar(base.collection('carteira')), listar(base.collection('pontos')), listar(base.collection('scores')).catch(() => []),
    listar(base.collection('aposentadoria')).catch(() => []), base.collection('orcamento').doc('atual').get(),
    base.collection('config').doc('dividas').get(), base.collection('config').doc('salario').get(),
    base.collection('config').doc('score_hist').get(),
    require('./salario').agirSalario('salario_previsao', { mes }, c).catch(() => null),
  ]);
  const sal = sp && sp[0] === 200 ? sp[1] : null;
  const orc = orcS && orcS.exists ? orcS.data() || {} : {};
  const lancs = lancsTodos.filter((x) => x.perfil !== 'pj');
  const reais = prv.realizados(lancs, 'data', hoje);
  const doMes = reais.filter((l) => String(l.data).startsWith(mes));

  // --- Tenho (liquidez: contas e dinheiro, sem investimentos longos) ---
  // O saldo vale na data em que foi informado; o que a pessoa lançou DEPOIS disso (Pix, gasto no débito, salário que
  // caiu) entra na conta, para "lançar um gasto" mudar o "Pode gastar". Compras no cartão ficam de fora (saem na fatura).
  const saldoBase = require('./financas').saldoDisponivel(contas).saldo;
  const marco = contas.map((k) => String(k.atualizado_em || '')).filter(Boolean).sort().pop() || '';
  const depois = (quando, data) => marco && String(quando || '') > marco && String(data || '') >= marco.slice(0, 10) && String(data || '') <= hoje;
  const doCartao = (l) => /fatura|cartao/i.test(String(l.documento || '') + ' ' + String(l.categoria || ''));
  const movLanc = reais.filter((l) => depois(l.criado_em || l.editado_em, l.data) && !doCartao(l));
  const movPag = pagamentos.filter((p) => depois(p.atualizado_em || p.criado_em, p.data_pagamento) && p.status !== 'previsto');
  const ajuste = r2(soma(movLanc.filter((l) => l.tipo === 'receita'), (l) => l.valor) - soma(movLanc.filter((l) => l.tipo === 'despesa'), (l) => l.valor) + soma(movPag, (p) => p.liquido));
  const tenho = saldoBase == null ? null : r2(saldoBase + ajuste);

  // --- Recebi no mês: entradas que já caíram (lançamentos + pagamentos do Salário que não vieram de lançamento) ---
  const recebiLanc = soma(doMes.filter((l) => l.tipo === 'receita'), (l) => l.valor);
  const recebiPag = sal ? soma((sal.recebidos || []).filter((p) => p.origem !== 'lancamento'), (p) => p.liquido) : 0;
  const recebi = r2(recebiLanc + recebiPag);

  // --- Falta receber: a previsão do Salário (líquido - adiantamento) ou o que está marcado como "a receber" ---
  const prev = prv.resumoPrevisto({ lancs: lancsTodos, pagamentos, dividas }, mes, hoje);
  const faltaSal = sal && sal.previsao ? r2(Number(sal.previsao.a_receber) || 0) : sal ? r2(sal.total_a_receber) : 0;
  const falta_receber = r2(Math.max(faltaSal, prev.a_receber || 0));
  const renda = sal && sal.previsao ? r2((Number(sal.previsao.liquido) || 0) + (Number(sal.previsao.extras) || 0))
    : r2(Math.max(recebi + falta_receber, 0));

  // --- A pagar (comprometido): contas previstas + faturas dos cartões + fixas do orçamento que ainda vão vencer ---
  const fatura = require('./cartoes').faturaDoMes;
  const faturas = r2(cartoes.reduce((s, k) => s + (k.fatura_atual > 0 ? Number(k.fatura_atual) : fatura(gastos, k.id, mes) || 0), 0));
  const diaHoje = Number(hoje.slice(8, 10));
  const fixas = Array.isArray(orc.fixas) ? orc.fixas : [];
  const fixasPend = soma(fixas.filter((f) => !f.dia || f.dia >= diaHoje), (f) => f.valor);
  const a_pagar = r2((prev.a_pagar || 0) + faturas + fixasPend);
  const comprometido_cadastrado = fixas.length > 0 || cartoes.length > 0 || (prev.a_pagar || 0) > 0 || dividas.length > 0;

  // --- Gasto variável: média diária dos 3 meses completos antes deste ---
  const ult3 = [1, 2, 3].map((n) => mesAntes(mes, n));
  const desp3 = reais.filter((l) => l.tipo === 'despesa' && ult3.includes(String(l.data).slice(0, 7)));
  const mesesCom = new Set(desp3.map((l) => String(l.data).slice(0, 7))).size;
  const gastoMensal = mesesCom ? r2(soma(desp3, (l) => l.valor) / mesesCom) : null;
  const gasto_diario = gastoMensal != null ? r2(gastoMensal / 30) : null;

  const dr = S.diasRestantes(hoje);
  const kpis = S.kpisMes({ tenho, falta_receber, comprometido: a_pagar, comprometido_cadastrado, dias_restantes: dr, gasto_diario });
  const despesasMes = soma(doMes.filter((l) => l.tipo === 'despesa'), (l) => l.valor);

  // --- Score ---
  const semDiv = !!(cfgDiv && cfgDiv.exists && (cfgDiv.data() || {}).sem_dividas);
  const resDiv = require('./dividas').resumoDividas(dividas, semDiv, renda);
  const guardado = soma(contas.filter((k) => /poupan|reserva/i.test(String(k.tipo || '') + ' ' + String(k.nome || ''))), (k) => k.saldo);
  const investeMes = soma(doMes.filter((l) => l.tipo === 'despesa' && INVEST.test(String(l.categoria || '') + ' ' + String(l.descricao || ''))), (l) => l.valor);
  const ultData = lancsTodos.map((l) => String(l.criado_em || l.data || '').slice(0, 10)).filter((d) => d && d <= hoje).sort().pop();
  const vencendo = require('./extra').pontosVencendo(pontos, hoje);
  const score = S.scoreSaude({
    renda: renda > 0 ? renda : null,
    sobra: renda > 0 ? r2(renda - despesasMes - a_pagar) : null,
    reserva_meses: gastoMensal > 0 && contas.length ? r2(guardado / gastoMensal) : null,
    divida_renda_pct: resDiv.sem ? 0 : resDiv.registradas ? resDiv.comprometimento_pct : null,
    rotativo: resDiv.registradas ? dividas.some((d) => ['cheque_especial', 'cartao'].includes(d.tipo) && Number(d.saldo) > 0) : resDiv.sem ? false : null,
    investe_pct: renda > 0 && (carteira.length || investeMes > 0) ? r2((investeMes / renda) * 100) : null,
    contas_em_dia: true, // contas atrasadas ainda não são registradas; entra na fase 4 (Mês)
    dias_desde_atualizacao: ultData ? dias(ultData, hoje) : null,
    pontos_vencendo: vencendo.length > 0,
  });
  // variação contra o mês passado (guarda um número por mês)
  const hist = histS && histS.exists ? histS.data() || {} : {};
  const anterior = typeof hist[mesAntes(mes, 1)] === 'number' ? hist[mesAntes(mes, 1)] : null;
  if (score.total != null && hist[mes] !== score.total) await base.collection('config').doc('score_hist').set({ ...hist, [mes]: score.total }).catch(() => {});
  score.variacao = score.total != null && anterior != null ? score.total - anterior : null;

  // --- Atenção (no máximo 3, do mais urgente ao menos) ---
  const alertas = [];
  if (kpis.alerta) alertas.push({ id: 'negativo', nivel: 'risco', texto: `Faltam R$ ${Math.abs(kpis.posso_mes).toFixed(2).replace('.', ',')} para fechar o mês.`, aba: 'mes' });
  for (const p of (prev.itens || []).filter((x) => x.tipo === 'pagar' && dias(hoje, x.data) <= 5)) alertas.push({ id: 'vence-' + p.id, nivel: 'atencao', texto: `${p.nome} vence ${p.data === hoje ? 'hoje' : 'em ' + dias(hoje, p.data) + ' dia(s)'}.`, aba: 'mes' });
  for (const k of cartoes) { const d = Number(k.dia_vencimento); if (d >= diaHoje && d - diaHoje <= 5 && (k.fatura_atual || 0) > 0) alertas.push({ id: 'fatura-' + k.id, nivel: 'atencao', texto: `Fatura do ${k.nome} vence ${d === diaHoje ? 'hoje' : 'dia ' + d}.`, aba: 'mes' }); }
  for (const v of vencendo) alertas.push({ id: 'pontos-' + v.id, nivel: 'atencao', texto: `${v.programa}: pontos vencem em ${v.dias} dia(s).`, aba: 'beneficios' });
  if (!comprometido_cadastrado) alertas.push({ id: 'fixas', nivel: 'info', texto: 'Cadastre suas contas fixas para o "pode gastar" ficar certo.', aba: 'raiox' });

  const conf = confianca({
    salario: !!(sal && (sal.previsao || (sal.recebidos || []).length)) || !!(cfgSal && cfgSal.exists), contas: contas.length > 0,
    fixas: comprometido_cadastrado, cartoes: cartoes.length > 0, dividas: resDiv.registradas || resDiv.sem,
    investimentos: carteira.length > 0, gastos: doMes.some((l) => l.tipo === 'despesa'), aposentadoria: apos.length > 0,
  });
  const sc = scores.slice().sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')))[0] || null;
  const ultimos = reais.slice().sort((a, b) => String(b.data).localeCompare(String(a.data))).slice(0, 5)
    .map((l) => ({ id: l.id, data: l.data, descricao: l.descricao, valor: l.valor, tipo: l.tipo, categoria: l.categoria || null }));

  return {
    hoje, mes, dias_restantes: dr,
    score, confianca: conf,
    kpis: { tenho, recebi, falta_receber, a_pagar, ...kpis, gasto_mes: despesasMes, renda: renda || null,
      origem: { tenho: !contas.length ? 'sem contas' : 'saldo das contas' + (marco ? ' informado em ' + marco.slice(8, 10) + '/' + marco.slice(5, 7) : '') + (movLanc.length + movPag.length ? ' + ' + (movLanc.length + movPag.length) + ' lançamento(s) depois' : ''), renda: sal && sal.previsao ? 'previsão do salário' : 'entradas lançadas', a_pagar: comprometido_cadastrado ? 'contas, faturas e fixas cadastradas' : 'nada cadastrado' } },
    barra_mes: renda > 0 ? { gasto: despesasMes, renda, pct: Math.min(100, Math.round((despesasMes / renda) * 100)) } : null,
    alertas: alertas.slice(0, 3),
    credito: sc ? { biro: sc.biro, score: sc.score, data: sc.data || null } : null,
    ultimos,
  };
}

async function agirPainel(acao, body, c) {
  if (acao !== 'painel_resumo') return null;
  return [200, await montarPainel(c)];
}

module.exports = { agirPainel, montarPainel, confianca };
