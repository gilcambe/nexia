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

const arred = (n) => Math.round(n * 100) / 100;

/** Meses que a reserva cobre. Sem despesa informada devolve null (não inventa). */
function mesesReserva(reserva, despesaMensal) {
  if (!(despesaMensal > 0)) return null;
  return Math.round((Math.max(0, reserva) / despesaMensal) * 10) / 10;
}

/**
 * Saúde financeira 0-100, só sobre indicadores com dado suficiente (valor null = lacuna).
 * Cada indicador vira uma nota de 0 a 100; a nota final é a média dos que existem.
 */
function saudeFinanceira({ renda, despesas, parcelasDividas, reservaMeses, dividaTotal, patrimonioAtivos, vencidas }) {
  const ind = []; const lacunas = [];
  const add = (nome, nota, texto) => (nota === null ? lacunas.push(nome) : ind.push({ nome, nota: Math.max(0, Math.min(100, Math.round(nota))), texto }));
  const temRenda = renda > 0;
  add('Capacidade de poupar', temRenda && despesas !== null ? ((renda - despesas) / renda) * 100 * 5 : null, 'Quanto da renda sobra (20% ou mais é nota máxima).');
  add('Comprometimento de renda', temRenda && parcelasDividas !== null ? 100 - (parcelasDividas / renda) * 100 * 2.5 : null, 'Quanto da renda vai para parcelas de dívidas (40% ou mais zera a nota).');
  add('Reserva de emergência', reservaMeses === null || reservaMeses === undefined ? null : (reservaMeses / 6) * 100, 'Meses de despesas cobertos (6 meses é nota máxima).');
  add('Endividamento', patrimonioAtivos > 0 && dividaTotal !== null ? 100 - (dividaTotal / patrimonioAtivos) * 100 : null, 'Peso das dívidas sobre o que você possui.');
  add('Regularidade', vencidas === null || vencidas === undefined ? null : (vencidas === 0 ? 100 : Math.max(0, 100 - vencidas * 34)), 'Contas e parcelas em dia.');
  if (!ind.length) return { nota: null, indicadores: [], lacunas, aviso: 'Ainda não há dados suficientes para uma nota.' };
  return { nota: Math.round(ind.reduce((t, i) => t + i.nota, 0) / ind.length), indicadores: ind, lacunas, aviso: lacunas.length ? 'A nota considera só o que já foi informado.' : null };
}

/**
 * Quitação de dívidas: avalanche (maior juros primeiro) ou bola de neve (menor saldo primeiro).
 * dividas: [{nome, saldo, juros_mes (%), parcela_minima}]; extra = reais a mais por mês.
 */
function estrategiaDividas(dividas, extra, metodo) {
  let d = (dividas || []).filter((x) => x.saldo > 0).map((x) => ({ nome: x.nome, saldo: centavos(x.saldo), juros: Number(x.juros_mes) || 0, minima: centavos(x.parcela_minima || 0) }));
  if (!d.length) return { meses: 0, jurosPagos: 0, ordem: [], viavel: true };
  const ordenar = metodo === 'bola_de_neve' ? (a, b) => a.saldo - b.saldo : (a, b) => b.juros - a.juros;
  const orcamento = d.reduce((t, x) => t + x.minima, 0) + centavos(extra || 0);
  if (orcamento <= 0) return { meses: null, jurosPagos: null, ordem: [], viavel: false };
  let meses = 0; let jurosTotal = 0; const ordem = [];
  while (d.some((x) => x.saldo > 0) && meses < 600) {
    meses++;
    for (const x of d) if (x.saldo > 0) { const j = Math.round(x.saldo * x.juros / 100); x.saldo += j; jurosTotal += j; }
    let disp = orcamento;
    for (const x of d) if (x.saldo > 0) { const p = Math.min(x.saldo, x.minima, disp); x.saldo -= p; disp -= p; }
    for (const x of [...d].filter((y) => y.saldo > 0).sort(ordenar)) { const p = Math.min(x.saldo, disp); x.saldo -= p; disp -= p; }
    for (const x of d) if (x.saldo === 0 && !ordem.includes(x.nome)) ordem.push(x.nome);
  }
  const viavel = !d.some((x) => x.saldo > 0);
  return { meses: viavel ? meses : null, jurosPagos: viavel ? reais(jurosTotal) : null, ordem, viavel };
}

/** Projeção com aporte mensal, rendimento e inflação (taxas anuais em %). Devolve valor nominal e real. */
function projecao({ inicial = 0, aporte = 0, meses, taxaAnual = 0, inflacaoAnual = 0 }) {
  const m = Math.max(0, Math.floor(meses));
  const i = Math.pow(1 + taxaAnual / 100, 1 / 12) - 1;
  let v = centavos(inicial); const ap = centavos(aporte);
  for (let k = 0; k < m; k++) v = Math.round(v * (1 + i)) + ap;
  const investido = centavos(inicial) + ap * m;
  const nominal = reais(v);
  const real = arred(nominal / Math.pow(1 + inflacaoAnual / 100, m / 12));
  return { meses: m, investido: reais(investido), nominal, real, rendimento: arred(nominal - reais(investido)) };
}

/** Quanto aportar por mês para chegar na meta no prazo (rendimento mensal composto). */
function aporteNecessario({ meta, inicial = 0, meses, taxaAnual = 0 }) {
  if (!(meses > 0)) return null;
  const i = Math.pow(1 + taxaAnual / 100, 1 / 12) - 1;
  const fv0 = inicial * Math.pow(1 + i, meses);
  if (fv0 >= meta) return 0;
  const fator = i === 0 ? meses : (Math.pow(1 + i, meses) - 1) / i;
  return Math.ceil(((meta - fv0) / fator) * 100) / 100;
}

/** "Posso comprar isso?" — só aritmética sobre a situação atual. */
function impactoCompra({ valor, parcelas = 1, sobraMensal, reserva, despesaMensal }) {
  const parcela = arred(valor / Math.max(1, parcelas));
  const sobraDepois = arred(sobraMensal - parcela);
  const pagarAVista = valor <= Math.max(0, reserva - (despesaMensal > 0 ? despesaMensal * 6 : 0));
  const reservaDepois = parcelas === 1 ? arred(reserva - valor) : reserva;
  const mesesAntes = mesesReserva(reserva, despesaMensal);
  const mesesDepois = mesesReserva(reservaDepois, despesaMensal);
  let veredito;
  if (sobraDepois < 0) veredito = 'nao';
  else if (parcelas === 1 && mesesDepois !== null && mesesDepois < 3) veredito = 'cuidado';
  else if (sobraDepois < sobraMensal * 0.3) veredito = 'cuidado';
  else veredito = 'sim';
  return { parcela, sobraDepois, reservaDepois, mesesReservaAntes: mesesAntes, mesesReservaDepois: mesesDepois, pagarAVistaSemTocarNaReserva: pagarAVista, veredito };
}

/** Milhas: custo de adquirir com bônus de transferência e comparação com o preço em dinheiro. */
function valeResgate({ milhas, taxas = 0, precoDinheiro, valorMilheiro }) {
  const custoMilhas = (milhas / 1000) * valorMilheiro + taxas;
  return { custoMilhas: arred(custoMilhas), precoDinheiro, economia: arred(precoDinheiro - custoMilhas), compensa: custoMilhas < precoDinheiro };
}
function milhasComBonus({ pontos, bonusPct = 0 }) { return Math.floor(pontos * (1 + bonusPct / 100)); }

module.exports = { conciliar, patrimonio, custoMilheiro, chave, mesesReserva, saudeFinanceira, estrategiaDividas, projecao, aporteNecessario, impactoCompra, valeResgate, milhasComBonus };
