'use strict';
/**
 * Kernex Finance, fase 4: inteligência de cartões. Funções PURAS (testáveis) + ações da API.
 * Regras: limite de crédito nunca soma em saldo disponível; "comprometido" é estimativa (parcelas de hoje em diante,
 * sem saber o que já foi pago); retorno em pontos só é calculado com o valor do milheiro que a PESSOA informou.
 */
const { custoMilheiro } = require('./motor');

const MES = /^\d{4}-\d{2}$/;
const cent = (v) => Math.round(Number(v) * 100);
const reais = (c) => c / 100;
const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const sem = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

function somarMes(mes, n) {
  const [a, m] = mes.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1 + n, 1)).toISOString().slice(0, 7);
}
/** Parcela do gasto que cai no mês (1..n) ou 0. Valor da parcela em centavos, com o resto na 1ª parcela. */
function parcelaNoMes(g, mes) {
  const n = Math.max(1, Number(g.parcelas) || 1);
  const inicio = String(g.data || '').slice(0, 7);
  if (!MES.test(inicio)) return null;
  for (let i = 0; i < n; i++) {
    if (somarMes(inicio, i) === mes) {
      const total = cent(g.valor); const base = Math.floor(total / n);
      return { numero: i + 1, de: n, centavos: i === 0 ? total - base * (n - 1) : base };
    }
  }
  return null;
}
/** Soma das parcelas de um cartão em um mês (fatura estimada). */
function faturaDoMes(gastos, cartaoId, mes) {
  let t = 0;
  for (const g of gastos || []) { if (g.cartao_id !== cartaoId) continue; const p = parcelaNoMes(g, mes); if (p) t += p.centavos; }
  return reais(t);
}
/** Próximas faturas: mês de referência + (n-1) meses. */
function previsaoFaturas(gastos, cartaoId, mesRef, n = 6) {
  return Array.from({ length: n }, (_, i) => { const mes = somarMes(mesRef, i); return { mes, valor: faturaDoMes(gastos, cartaoId, mes) }; });
}
/** Limite comprometido (estimado) = todas as parcelas do mês de referência em diante. */
function limiteDoCartao(cartao, gastos, mesRef) {
  let c = 0;
  for (const g of gastos || []) {
    if (g.cartao_id !== cartao.id) continue;
    const n = Math.max(1, Number(g.parcelas) || 1); const inicio = String(g.data || '').slice(0, 7);
    if (!MES.test(inicio)) continue;
    for (let i = 0; i < n; i++) { const m = somarMes(inicio, i); if (m >= mesRef) { const p = parcelaNoMes(g, m); if (p) c += p.centavos; } }
  }
  const limite = Number(cartao.limite) || 0;
  return { limite, comprometido: reais(c), disponivel: reais(cent(limite) - c), pct: limite > 0 ? Math.round((c / cent(limite)) * 1000) / 10 : null };
}
/** Retorno em % do gasto: cashback + pontos × valor do milheiro informado. null se não dá para saber. */
function retornoPct(cartao) {
  const cash = Number(cartao.cashback_pct) || 0;
  const pts = Number(cartao.pontos_por_real) || 0;
  const vm = Number(cartao.valor_milheiro);
  if (!(pts > 0) && !(cash > 0)) return null;
  if (pts > 0 && !(vm > 0)) return cash > 0 ? { pct: cash, parcial: true } : null;
  return { pct: Math.round((cash + (pts * (vm > 0 ? vm : 0)) / 10) * 100) / 100, parcial: false };
}
/** Qual cartão rende mais. Cartões sem dados de retorno ficam no fim, avisados. */
function melhorCartao(cartoes) {
  const lista = (cartoes || []).map((c) => ({ cartao_id: c.id, nome: c.nome, retorno: retornoPct(c), anuidade: Number(c.anuidade) || 0 }));
  const com = lista.filter((x) => x.retorno).sort((a, b) => b.retorno.pct - a.retorno.pct);
  const sem_dados = lista.filter((x) => !x.retorno).map((x) => ({ cartao_id: x.cartao_id, nome: x.nome, falta: 'pontos por real e valor do milheiro (ou cashback)' }));
  return { ranking: com, sem_dados };
}
/** A anuidade compensa? retorno anual − anuidade, e custo efetivo do milheiro quando há pontos. */
function custoBeneficioAnuidade(cartao, gastoAnual) {
  const anuidade = Number(cartao.anuidade) || 0;
  const r = retornoPct(cartao);
  if (!r || r.parcial) return { anuidade, retorno_anual: null, liquido: null, compensa: null, motivo: 'faltam pontos por real e valor do milheiro' };
  const retorno = reais(Math.round(cent(gastoAnual) * (r.pct / 100)));
  const pontos = (Number(cartao.pontos_por_real) || 0) * Number(gastoAnual);
  return { anuidade, retorno_anual: retorno, liquido: reais(cent(retorno) - cent(anuidade)), compensa: retorno >= anuidade,
    custo_milheiro: pontos > 0 ? custoMilheiro({ preco: 0, milhas: pontos, anuidade }) : null };
}
/** Impacto de uma compra nova: cabe no limite? quanto muda a fatura de cada mês? */
function simularCompra({ cartao, gastos, mesRef, valor, parcelas = 1 }) {
  const v = Number(valor); const n = Math.max(1, Number(parcelas) || 1);
  const antes = limiteDoCartao(cartao, gastos, mesRef);
  const fake = { cartao_id: cartao.id, valor: v, parcelas: n, data: mesRef + '-01' };
  const depois = limiteDoCartao(cartao, [...(gastos || []), fake], mesRef);
  const parcelasPrev = previsaoFaturas([...(gastos || []), fake], cartao.id, mesRef, Math.min(n, 12)).map((p, i) => ({ ...p, valor_antes: faturaDoMes(gastos, cartao.id, p.mes), parcela_nova: reais(parcelaNoMes(fake, p.mes).centavos) }));
  return { cabe: depois.disponivel >= 0, disponivel_antes: antes.disponivel, disponivel_depois: depois.disponivel, pct_depois: depois.pct, faturas: parcelasPrev };
}
/** Compras recorrentes: mesmo estabelecimento, valor parecido (±10%), em 3 meses diferentes ou mais. */
function recorrencias(lancs) {
  const grupos = new Map();
  for (const l of lancs || []) { if (l.tipo !== 'despesa') continue; const k = sem(l.estabelecimento || l.descricao); if (!k) continue; (grupos.get(k) || grupos.set(k, []).get(k)).push(l); }
  const out = [];
  for (const [, arr] of grupos) {
    const meses = [...new Set(arr.map((l) => String(l.data).slice(0, 7)))].sort();
    if (meses.length < 3) continue;
    const med = arr.reduce((s, l) => s + cent(l.valor), 0) / arr.length;
    if (!arr.every((l) => Math.abs(cent(l.valor) - med) <= med * 0.1)) continue;
    out.push({ estabelecimento: arr[0].estabelecimento || arr[0].descricao, valor_medio: reais(Math.round(med)), meses: meses.length, proximo_mes: somarMes(meses[meses.length - 1], 1) });
  }
  return out.sort((a, b) => b.valor_medio - a.valor_medio);
}
/** Cobranças para REVISAR (não é acusação): repetida no mesmo dia, ou valor muito acima do histórico daquele lugar. */
function cobrancasSuspeitas(lancs) {
  const grupos = new Map(); const out = [];
  for (const l of (lancs || []).filter((x) => x.tipo === 'despesa')) { const k = sem(l.estabelecimento || l.descricao); (grupos.get(k) || grupos.set(k, []).get(k)).push(l); }
  for (const [, arr] of grupos) {
    arr.sort((a, b) => String(a.data).localeCompare(String(b.data)));
    arr.forEach((l, i) => {
      const dia = Date.parse(l.data);
      const igual = arr.find((o, j) => j < i && cent(o.valor) === cent(l.valor) && Math.abs(Date.parse(o.data) - dia) <= 86400000);
      if (igual) { out.push({ motivo: 'cobrança repetida em até 1 dia', lancamento: l }); return; }
      const antes = arr.slice(0, i);
      if (antes.length >= 3) { const med = antes.reduce((s, o) => s + cent(o.valor), 0) / antes.length; if (cent(l.valor) >= med * 3) out.push({ motivo: 'valor 3 vezes acima do que você costuma pagar aqui', lancamento: l }); }
    });
  }
  return out;
}

async function agirCartoes(acao, body, c) {
  if (!['cartao_visao', 'cartao_simular', 'cartao_inteligencia'].includes(acao)) return null;
  const { base, listar, agoraIso } = c;
  const mesRef = texto(body.mes, 7) || agoraIso.slice(0, 7);
  if (!MES.test(mesRef)) return [400, { error: 'O mês precisa estar no formato AAAA-MM.' }];
  const [cartoes, gastos] = await Promise.all([listar(base.collection('cartoes')), listar(base.collection('gastos'))]);
  switch (acao) {
    case 'cartao_visao': {
      const dia = new Date(agoraIso).getUTCDate();
      const lista = cartoes.map((k) => ({ ...k, ...limiteDoCartao(k, gastos, mesRef), fatura_mes: faturaDoMes(gastos, k.id, mesRef),
        proximas: previsaoFaturas(gastos, k.id, mesRef, 6), vence_em_dias: (k.dia_vencimento - dia + 31) % 31,
        retorno: retornoPct(k), anuidade_analise: k.anuidade ? custoBeneficioAnuidade(k, Number(body.gasto_anual) || faturaDoMes(gastos, k.id, mesRef) * 12) : null }));
      return [200, { mes: mesRef, cartoes: lista, total_comprometido: reais(lista.reduce((s, k) => s + cent(k.comprometido), 0)), total_limite: reais(lista.reduce((s, k) => s + cent(k.limite || 0), 0)), melhor: melhorCartao(cartoes), aviso: 'Comprometido é estimado: soma as parcelas do mês em diante, sem saber o que já foi pago. Limite de cartão não é dinheiro.' }];
    }
    case 'cartao_simular': {
      const k = cartoes.find((x) => x.id === texto(body.cartao_id, 60));
      if (!k) return [400, { error: 'Escolha o cartão.' }];
      const valor = Number(body.valor);
      if (!Number.isFinite(valor) || valor <= 0) return [400, { error: 'O valor precisa ser maior que zero.' }];
      const parcelas = body.parcelas === undefined || body.parcelas === '' ? 1 : Number(body.parcelas);
      if (!Number.isInteger(parcelas) || parcelas < 1 || parcelas > 48) return [400, { error: 'As parcelas vão de 1 a 48.' }];
      return [200, { cartao: k.nome, valor, parcelas, ...simularCompra({ cartao: k, gastos, mesRef, valor, parcelas }) }];
    }
    case 'cartao_inteligencia': {
      const lancs = await listar(base.collection('lancamentos'));
      return [200, { recorrentes: recorrencias(lancs), suspeitas: cobrancasSuspeitas(lancs).slice(0, 30), parcelas_em_documentos: lancs.filter((l) => l.parcelas_total > 1 && l.parcela < l.parcelas_total).slice(0, 50).map((l) => ({ descricao: l.descricao, parcela: l.parcela, de: l.parcelas_total, valor: l.valor })) }];
    }
    default: return null;
  }
}

module.exports = { agirCartoes, somarMes, parcelaNoMes, faturaDoMes, previsaoFaturas, limiteDoCartao, retornoPct, melhorCartao, custoBeneficioAnuidade, simularCompra, recorrencias, cobrancasSuspeitas };
