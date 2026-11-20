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
  const [lancsTodos, contas, pagamentos, dividas, cartoes, gastos, carteira, pontos, scores, apos, orcS, cfgDiv, cfgSal, histS, insS, sp] = await Promise.all([
    listar(base.collection('lancamentos')), listar(base.collection('contas')), listar(base.collection('pagamentos')),
    listar(base.collection('dividas')), listar(base.collection('cartoes')), listar(base.collection('gastos')),
    listar(base.collection('carteira')), listar(base.collection('pontos')), listar(base.collection('scores')).catch(() => []),
    listar(base.collection('aposentadoria')).catch(() => []), base.collection('orcamento').doc('atual').get(),
    base.collection('config').doc('dividas').get(), base.collection('config').doc('salario').get(),
    base.collection('config').doc('score_hist').get(), base.collection('config').doc('insights').get(),
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
  const doCartao = (l) => l.meio === 'vale' || /fatura|cartao/i.test(String(l.documento || '') + ' ' + String(l.categoria || ''));
  const movLanc = reais.filter((l) => depois(l.criado_em || l.editado_em, l.data) && !doCartao(l));
  const movPag = pagamentos.filter((p) => depois(p.atualizado_em || p.criado_em, p.data_pagamento) && p.status !== 'previsto');
  const ajuste = r2(soma(movLanc.filter((l) => l.tipo === 'receita'), (l) => l.valor) - soma(movLanc.filter((l) => l.tipo === 'despesa'), (l) => l.valor) + soma(movPag, (p) => p.liquido));
  const tenho = saldoBase == null ? null : r2(saldoBase + ajuste);

  // --- Recebi no mês: entradas que já caíram (lançamentos + pagamentos do Salário que não vieram de lançamento) ---
  const recebiLanc = soma(doMes.filter((l) => l.tipo === 'receita'), (l) => l.valor);
  const recebiPag = sal ? soma((sal.recebidos || []).filter((p) => p.origem !== 'lancamento'), (p) => p.liquido) : 0;
  // Sem o adiantamento lançado, a previsão do Salário supõe que ele já caiu (dia 15): entra no Recebi como estimado,
  // senão o "Falta receber" desconta um dinheiro que não aparece em lugar nenhum.
  const ad = sal && sal.previsao && sal.previsao.adiantamento;
  const adEstimado = ad && ad.automatico && ad.status === 'caiu' ? r2(ad.valor) : 0;
  const recebi = r2(recebiLanc + recebiPag + adEstimado);

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
  // Compras do cartão lidas da fatura entram no A pagar pela data de VENCIMENTO da fatura (plano, tela Mês).
  // O total da fatura (fatura_gravar, categoria 'fatura') vale mais que a soma das compras lidas do mesmo vencimento.
  const ehFatura = (l) => l.categoria === 'fatura';
  const vencComTotal = new Set(lancs.filter(ehFatura).map((l) => String(l.vencimento || l.data).slice(0, 10)));
  const cartaoAberto = reais.filter((l) => l.tipo === 'despesa' && !ehFatura(l) && l.vencimento && String(l.vencimento) > hoje && !vencComTotal.has(String(l.vencimento).slice(0, 10)));
  const faturasLidas = {};
  for (const l of cartaoAberto) { const v = String(l.vencimento).slice(0, 10); faturasLidas[v] = r2((faturasLidas[v] || 0) + (Number(l.valor) || 0)); }
  // Dono 19/11: o print da fatura aberta (vence 06/12) gravava uma conta com data futura e ela sumia de todas as telas.
  // Próximas contas = o que vence depois deste mês, em até 45 dias: contas lançadas com data futura e faturas lidas.
  const ate45 = new Date(Date.parse(hoje + 'T00:00:00Z') + 45 * 86400000).toISOString().slice(0, 10);
  const proximas_contas = [
    ...prv.previstos(lancs, 'data', hoje).filter((l) => l.tipo === 'despesa' && !String(l.data).startsWith(mes) && String(l.data) <= ate45)
      .map((l) => ({ data: String(l.data), nome: l.descricao || 'Conta', valor: Number(l.valor) || 0, origem: /fatura|cartao/i.test(String(l.documento || '') + String(l.categoria || '') + String(l.descricao || '')) ? 'fatura' : 'conta' })),
    ...Object.entries(faturasLidas).filter(([v]) => !v.startsWith(mes) && v <= ate45).map(([v, x]) => ({ data: v, nome: 'Fatura do cartão', valor: x, origem: 'fatura' })),
  ].map((x) => ({ ...x, dias: dias(hoje, x.data) })).sort((a, b) => a.data.localeCompare(b.data));
  const faturasMes = r2(Object.entries(faturasLidas).filter(([v]) => v.startsWith(mes)).reduce((t, [, x]) => t + x, 0));
  const a_pagar = r2((prev.a_pagar || 0) + faturas + fixasPend + faturasMes);
  const comprometido_cadastrado = fixas.length > 0 || cartaoAberto.length > 0 || cartoes.length > 0 || (prev.a_pagar || 0) > 0 || dividas.length > 0;

  // --- Gasto variável: média diária dos 3 meses completos antes deste ---
  const ult3 = [1, 2, 3].map((n) => mesAntes(mes, n));
  const desp3 = reais.filter((l) => l.tipo === 'despesa' && !ehFatura(l) && ult3.includes(String(l.data).slice(0, 7)));
  const mesesCom = new Set(desp3.map((l) => String(l.data).slice(0, 7))).size;
  const gastoMensal = mesesCom ? r2(soma(desp3, (l) => l.valor) / mesesCom) : null;
  const gasto_diario = gastoMensal != null ? r2(gastoMensal / 30) : null;

  const dr = S.diasRestantes(hoje);
  const kpis = S.kpisMes({ tenho, falta_receber, comprometido: a_pagar, comprometido_cadastrado, dias_restantes: dr, gasto_diario });
  const despesasMes = soma(doMes.filter((l) => l.tipo === 'despesa' && !ehFatura(l)), (l) => l.valor); // pagar a fatura não é gasto novo

  // --- Score ---
  const semDiv = !!(cfgDiv && cfgDiv.exists && (cfgDiv.data() || {}).sem_dividas);
  const resDiv = require('./dividas').resumoDividas(dividas, semDiv, renda);
  const guardado = soma(contas.filter((k) => /poupan|reserva/i.test(String(k.tipo || '') + ' ' + String(k.nome || ''))), (k) => k.saldo);
  const investeMes = soma(doMes.filter((l) => l.tipo === 'despesa' && INVEST.test(String(l.categoria || '') + ' ' + String(l.descricao || ''))), (l) => l.valor);
  const ultData = lancsTodos.map((l) => String(l.criado_em || l.data || '').slice(0, 10)).filter((d) => d && d <= hoje).sort().pop();
  const vencendo = require('./extra').pontosVencendo(pontos, hoje);
  const score = S.scoreSaude({
    renda: renda > 0 ? renda : null,
    sobra: renda > 0 && (despesasMes > 0 || comprometido_cadastrado) ? r2(renda - despesasMes - a_pagar) : null, // sem nenhum gasto, não dá para medir a sobra
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
  const NOMEP = { adiantamento: 'Adiantamento', mensal: 'Salário', decimo_terceiro_1: '13º (1ª parcela)', decimo_terceiro_2: '13º (2ª parcela)', ferias: 'Férias', plr: 'PLR', outro: 'Recebimento' };
  const pagsReais = pagamentos.filter((x) => x.data_pagamento && String(x.data_pagamento) <= hoje && x.status !== 'previsto').map((x) => ({ id: x.id, data: x.data_pagamento, descricao: NOMEP[x.tipo] || x.empresa || 'Recebimento', valor: x.liquido, tipo: 'receita', categoria: 'renda' }));
  const ultimos = [...reais, ...pagsReais].slice().sort((a, b) => String(b.data).localeCompare(String(a.data))).slice(0, 5)
    .map((l) => ({ id: l.id, data: l.data, descricao: l.descricao, valor: l.valor, tipo: l.tipo, categoria: l.categoria || null }));

  const out = {
    hoje, mes, dias_restantes: dr,
    score, confianca: conf,
    kpis: { tenho, recebi, recebi_estimado: adEstimado, falta_receber, a_pagar, ...kpis, gasto_mes: despesasMes, renda: renda || null,
      origem: { tenho: !contas.length ? 'sem contas' : 'saldo das contas' + (marco ? ' informado em ' + marco.slice(8, 10) + '/' + marco.slice(5, 7) : '') + (movLanc.length + movPag.length ? ' + ' + (movLanc.length + movPag.length) + ' lançamento(s) depois' : ''), renda: (sal && sal.previsao ? 'previsão do salário' : 'entradas lançadas') + (adEstimado ? ' (adiantamento do dia 15 estimado, não lançado)' : ''), a_pagar: comprometido_cadastrado ? 'contas, faturas e fixas cadastradas' : 'nada cadastrado' } },
    mes_detalhe: (() => {
      // Agenda do que falta pagar no mês, em ordem de data; vermelho só se vence em até 3 dias e passa do saldo.
      const itens = [
        ...(prev.itens || []).filter((x) => x.tipo === 'pagar').map((x) => ({ data: x.data, nome: x.nome, valor: Number(x.valor) || 0, origem: x.origem })),
        ...fixas.filter((x) => x.dia && x.dia >= diaHoje).map((x) => ({ data: mes + '-' + String(x.dia).padStart(2, '0'), nome: x.nome, valor: Number(x.valor) || 0, origem: 'fixa' })),
        ...fixas.filter((x) => !x.dia).map((x) => ({ data: null, nome: x.nome, valor: Number(x.valor) || 0, origem: 'fixa' })),
        ...Object.entries(faturasLidas).filter(([v]) => v.startsWith(mes)).map(([v, x]) => ({ data: v, nome: 'Fatura do cartão', valor: x, origem: 'fatura' })),
        ...cartoes.map((k) => ({ k, v: k.fatura_atual > 0 ? Number(k.fatura_atual) : fatura(gastos, k.id, mes) || 0 })).filter((x) => x.v > 0).map((x) => ({ data: x.k.dia_vencimento ? mes + '-' + String(Math.min(28, x.k.dia_vencimento)).padStart(2, '0') : null, nome: 'Fatura ' + x.k.nome, valor: x.v, origem: 'cartao' })),
      ].sort((a, b) => String(a.data || '9').localeCompare(String(b.data || '9')));
      let acum = 0;
      for (const x of itens) { acum += x.valor; x.risco = !!(x.data && dias(hoje, x.data) <= 3 && tenho != null && acum > tenho); }
      // Gastos por categoria, com a média dos 3 meses anteriores; a dica é a categoria mais acima da média (> 120%).
      const porCat = {};
      for (const l of doMes.filter((x) => x.tipo === 'despesa' && !ehFatura(x))) { const k = l.categoria || 'outros'; porCat[k] = r2((porCat[k] || 0) + (Number(l.valor) || 0)); }
      const media = {};
      for (const l of desp3) { const k = l.categoria || 'outros'; media[k] = (media[k] || 0) + (Number(l.valor) || 0) / Math.max(1, mesesCom); }
      const categorias = Object.entries(porCat).map(([k, v]) => ({ categoria: k, valor: v, pct: despesasMes > 0 ? Math.round((v / despesasMes) * 100) : 0, media3: media[k] ? r2(media[k]) : null, acima_pct: media[k] ? Math.round((v / media[k] - 1) * 100) : null })).sort((a, b) => b.valor - a.valor);
      const alta = categorias.filter((x) => x.acima_pct != null && x.acima_pct > 20).sort((a, b) => b.acima_pct - a.acima_pct)[0];
      const sp = sal && sal.previsao;
      return {
        entrou: recebi, falta_entrar: falta_receber, saiu: despesasMes,
        salario: sp ? { liquido: sp.liquido, fonte: (sal.recebidos || []).some((p) => p.tipo === 'mensal') ? 'holerite' : 'estimativa', adiantamento: sp.adiantamento || null, data_salario: sp.data_salario || null } : null,
        a_pagar_itens: itens, a_pagar_total: r2(itens.reduce((t, x) => t + x.valor, 0)), proximas_faturas: Object.entries(faturasLidas).filter(([v]) => !v.startsWith(mes)).map(([v, x]) => ({ vencimento: v, valor: x })),
        categorias, dica: alta ? { categoria: alta.categoria, acima_pct: alta.acima_pct, texto: `${alta.categoria} está ${alta.acima_pct}% acima da média dos últimos 3 meses.` } : null,
      };
    })(),
    barra_mes: renda > 0 ? { gasto: despesasMes, renda, pct: Math.min(100, Math.round((despesasMes / renda) * 100)) } : null,
    alertas: alertas.slice(0, 3),
    credito: sc ? { biro: sc.biro, score: sc.score, data: sc.data || null } : null,
    ultimos,
    proximas_contas,
    proximos_meses: require('./meses').proximosMeses({ hoje, meses: 6, dividas, fixas,
      futuros: prv.previstos(lancs, 'data', hoje).filter((l) => l.tipo === 'despesa'),
      faturas: Object.entries(faturasLidas).map(([v, x]) => ({ vencimento: v, valor: x })) }),
  };
  // Fase 7: motor de decisões. Avisos urgentes primeiro, depois as dicas; no máximo 3; "dispensar" vale 30 dias.
  const dispensados = (insS && insS.exists && (insS.data() || {}).dispensados) || {};
  const vivo = (id) => !dispensados[id] || dias(String(dispensados[id]).slice(0, 10), hoje) > 30;
  const md = out.mes_detalhe || {};
  const ins = require('./insights').gerarInsights({
    hoje, tenho, gasto_mensal: gastoMensal, reserva_meses: gastoMensal > 0 && contas.length ? r2(guardado / gastoMensal) : null,
    faturas: [...(md.a_pagar_itens || []).filter((x) => /fatura|cartao/.test(x.origem) && x.data).map((x) => ({ nome: x.nome, valor: x.valor, dias: dias(hoje, x.data) })), ...proximas_contas.filter((x) => x.origem === 'fatura').map((x) => ({ nome: x.nome, valor: x.valor, dias: x.dias }))],
    dividas, pontos: require('./beneficios').resumoPontos(pontos, hoje).programas, mes_num: Number(mes.slice(5, 7)),
    categorias: (md.categorias || []).map((x) => ({ ...x })), investido: r2(carteira.filter((i) => i.tipo !== 'fgts').reduce((t, i) => t + (Number(i.valor) || 0), 0)), aporte_mensal: investeMes,
  });
  const urgentes = alertas.filter((a) => !/^pontos-/.test(a.id));
  out.alertas = [...urgentes, ...ins.map((x) => ({ id: x.id, nivel: x.nivel, texto: x.texto, dado: x.dado, aba: x.acao.aba, acao: x.acao.rotulo, dispensavel: true }))]
    .filter((a) => vivo(a.id)).slice(0, 3);
  return out;
}

async function agirPainel(acao, body, c) {
  if (acao === 'insight_dispensar') {
    const id = String(body.id || '').slice(0, 80); if (!id) return [400, { error: 'Diga qual dica dispensar.' }];
    const ref = c.base.collection('config').doc('insights'); const sn = await ref.get();
    const atual = (sn && sn.exists && (sn.data() || {}).dispensados) || {};
    await ref.set({ dispensados: { ...atual, [id]: c.agoraIso } });
    return [200, { ok: true }];
  }
  if (acao !== 'painel_resumo') return null;
  return [200, await montarPainel(c)];
}

module.exports = { agirPainel, montarPainel, confianca };
