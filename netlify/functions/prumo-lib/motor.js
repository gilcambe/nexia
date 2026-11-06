'use strict';
// Motor financeiro determinístico do Kernex Finance. A IA só LÊ e CLASSIFICA; toda soma sai daqui.
const centavos = (v) => Math.round(Number(v) * 100);
const reais = (c) => c / 100;

/** Chave de duplicidade: mesma data, mesmo valor, mesmo estabelecimento (sem acento/caixa), mesma parcela. */
function chave(l) {
  const nome = String(l.estabelecimento || l.descricao || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return [l.data, centavos(l.valor), nome, l.parcela || 0].join('|');
}

/**
 * Concilia lançamentos vindos de documentos diferentes.
 * tipo: 'despesa' | 'receita' | 'transferencia_propria' | 'pagamento_fatura'
 * Só despesa e receita entram no total; o resto é liquidação/movimento interno.
 * Duplicados e dúvidas vão para "conferir": nada duvidoso vira dado confirmado em silêncio.
 */
function conciliar(lancamentos) {
  const vistos = new Map(); const confirmados = []; const conferir = [];
  for (const l of lancamentos || []) {
    const v = Number(l.valor);
    if (!Number.isFinite(v) || !l.data || !/^\d{4}-\d{2}-\d{2}$/.test(l.data)) { conferir.push({ ...l, motivo: 'dados incompletos' }); continue; }
    if (typeof l.confianca === 'number' && l.confianca < 0.8) { conferir.push({ ...l, motivo: 'leitura com pouca confiança' }); continue; }
    const k = chave(l);
    if (vistos.has(k)) { conferir.push({ ...l, motivo: 'possível duplicidade de ' + vistos.get(k) }); continue; }
    vistos.set(k, l.documento || 'outro documento');
    confirmados.push(l);
  }
  let rec = 0; let desp = 0;
  for (const l of confirmados) {
    if (l.tipo === 'receita') rec += centavos(l.valor);
    else if (l.tipo === 'despesa') desp += centavos(l.valor);
  }
  return { confirmados, conferir, receitas: reais(rec), despesas: reais(desp), saldo: reais(rec - desp) };
}

/** Patrimônio líquido = tudo que possui menos tudo que deve. Limite de crédito NÃO é dinheiro. */
function patrimonio({ contas = [], investimentos = [], milhas = [], bens = [], dividas = [] }) {
  const soma = (a) => a.reduce((t, x) => t + centavos(x.valor), 0);
  const ativos = soma(contas) + soma(investimentos) + soma(milhas) + soma(bens);
  const passivos = soma(dividas);
  return { ativos: reais(ativos), passivos: reais(passivos), liquido: reais(ativos - passivos) };
}

/** Custo efetivo do milheiro: (preço pago + anuidade rateada) / (milhas/1000). */
function custoMilheiro({ preco, milhas, anuidade = 0 }) {
  if (!(milhas > 0)) return null;
  return Math.round(((preco + anuidade) / (milhas / 1000)) * 100) / 100;
}

/** Totais de receita e despesa (e despesa por categoria) só dos tipos que contam; o resto é movimento interno. */
function totais(lancs) {
  let r = 0; let d = 0; const cat = {};
  for (const l of lancs || []) {
    const c = centavos(l.valor);
    if (!Number.isFinite(c)) continue;
    if (l.tipo === 'receita') r += c;
    else if (l.tipo === 'despesa') { d += c; const k = l.categoria || 'outros'; cat[k] = (cat[k] || 0) + c; }
  }
  return { receitas: reais(r), despesas: reais(d), por_categoria: Object.fromEntries(Object.entries(cat).map(([k, v]) => [k, reais(v)])) };
}

/**
 * Simula a quitação de dívidas mês a mês, tudo em centavos.
 * Cada mês: juros entram no saldo; cada dívida recebe sua parcela; a sobra do orçamento (parcelas de hoje + extra)
 * vai para a dívida-alvo da estratégia (avalanche = maior juros primeiro; bola_de_neve = menor saldo primeiro).
 * rolar:false = baseline "só o mínimo": cada dívida paga só a própria parcela, sem redirecionar nada.
 * nunca:true quando não quita em maxMeses (a parcela nem cobre os juros).
 */
function simularQuitacao(dividas, { extra = 0, estrategia = 'avalanche', rolar = true, maxMeses = 600 } = {}) {
  const d = (dividas || []).map((x) => ({ credor: x.credor || x.nome || 'dívida', saldo: centavos(x.saldo), taxa: Number(x.juros_mes) || 0, parcela: centavos(x.parcela || 0) })).filter((x) => x.saldo > 0);
  const orcamento = d.reduce((t, x) => t + x.parcela, 0) + (rolar ? centavos(extra || 0) : 0);
  let juros = 0; let pago = 0; let mes = 0; const ordem = [];
  const ativas = () => d.filter((x) => x.saldo > 0);
  while (ativas().length && mes < maxMeses) {
    mes++;
    for (const x of ativas()) { const j = Math.round((x.saldo * x.taxa) / 100); x.saldo += j; juros += j; }
    let sobra = orcamento;
    for (const x of ativas()) { const v = Math.min(x.parcela, x.saldo); x.saldo -= v; pago += v; sobra -= v; }
    if (rolar) {
      const alvos = ativas().sort(estrategia === 'bola_de_neve' ? (a, b) => a.saldo - b.saldo : (a, b) => b.taxa - a.taxa || a.saldo - b.saldo);
      for (const x of alvos) { if (sobra <= 0) break; const v = Math.min(sobra, x.saldo); x.saldo -= v; pago += v; sobra -= v; }
    }
    for (const x of d) if (x.saldo === 0 && !x.fim) { x.fim = mes; ordem.push({ credor: x.credor, mes }); }
  }
  const nunca = ativas().length > 0;
  return { meses: nunca ? null : mes, juros_pagos: nunca ? null : reais(juros), total_pago: nunca ? null : reais(pago), nunca, ordem };
}
/** Compara só o mínimo, avalanche e bola de neve, com a economia de juros de cada uma. */
function compararEstrategias(dividas, extra = 0) {
  const base = simularQuitacao(dividas, { rolar: false });
  const av = simularQuitacao(dividas, { extra, estrategia: 'avalanche' });
  const bn = simularQuitacao(dividas, { extra, estrategia: 'bola_de_neve' });
  const eco = (x) => (base.nunca || x.nunca ? null : Math.round((base.juros_pagos - x.juros_pagos) * 100) / 100);
  const viaveis = [['avalanche', av], ['bola_de_neve', bn]].filter(([, x]) => !x.nunca).sort((a, b) => a[1].juros_pagos - b[1].juros_pagos || a[1].meses - b[1].meses);
  return { so_minimo: base, avalanche: { ...av, economia_vs_minimo: eco(av) }, bola_de_neve: { ...bn, economia_vs_minimo: eco(bn) }, melhor: viaveis.length ? viaveis[0][0] : null,
    diferenca_avalanche_bola: av.nunca || bn.nunca ? null : Math.round((bn.juros_pagos - av.juros_pagos) * 100) / 100 };
}
/** Quitação antecipada: usa um valor à vista na dívida de maior juros e mostra os juros que deixam de ser pagos. */
function quitacaoAntecipada(dividas, valor, extra = 0) {
  const lista = (dividas || []).map((x) => ({ ...x }));
  const alvo = lista.filter((x) => Number(x.saldo) > 0).sort((a, b) => (Number(b.juros_mes) || 0) - (Number(a.juros_mes) || 0))[0];
  const sem = simularQuitacao(lista, { extra });
  if (!alvo) return { valor_usado: 0, alvo: null, juros_sem: sem.juros_pagos, juros_com: sem.juros_pagos, economia: 0, meses_sem: sem.meses, meses_com: sem.meses };
  const usado = Math.min(centavos(valor), centavos(alvo.saldo));
  alvo.saldo = reais(centavos(alvo.saldo) - usado);
  const com = simularQuitacao(lista, { extra });
  return { valor_usado: reais(usado), alvo: alvo.credor || alvo.nome || 'dívida', juros_sem: sem.juros_pagos, juros_com: com.juros_pagos,
    economia: sem.nunca || com.nunca ? null : Math.round((sem.juros_pagos - com.juros_pagos) * 100) / 100, meses_sem: sem.meses, meses_com: com.meses };
}
/** Renegociação ou troca por dívida mais barata: custo (juros + taxas) de seguir como está × aceitar a proposta. */
function renegociar({ saldo, parcela_atual, juros_mes_atual, nova_taxa_mes, prazo_meses, taxa_fixa = 0 }) {
  const atual = simularQuitacao([{ saldo, parcela: parcela_atual, juros_mes: juros_mes_atual }], { rolar: false });
  const i = (Number(nova_taxa_mes) || 0) / 100; const n = Number(prazo_meses);
  const financiado = centavos(saldo) + centavos(taxa_fixa);
  const pmt = i === 0 ? Math.round(financiado / n) : Math.round((financiado * i) / (1 - Math.pow(1 + i, -n)));
  const custoNovo = pmt * n - centavos(saldo);
  return { atual: { meses: atual.meses, juros: atual.juros_pagos, nunca: atual.nunca }, nova: { parcela: reais(pmt), prazo: n, custo_total_juros_e_taxas: reais(custoNovo) },
    economia: atual.nunca ? null : Math.round((atual.juros_pagos - reais(custoNovo)) * 100) / 100, compensa: atual.nunca ? true : atual.juros_pagos > reais(custoNovo) };
}

module.exports = { conciliar, patrimonio, custoMilheiro, chave, totais, simularQuitacao, compararEstrategias, quitacaoAntecipada, renegociar };
