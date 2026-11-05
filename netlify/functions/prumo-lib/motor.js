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

module.exports = { conciliar, patrimonio, custoMilheiro, chave, totais };
