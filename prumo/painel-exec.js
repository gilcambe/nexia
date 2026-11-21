// prumo/painel-exec.js - Núcleo de cálculos do Painel Financeiro (funções puras)

const NOMES_MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function extrairAnoMes(dataStr) {
  if (!dataStr) return { ano: 0, mes: 0 };
  if (typeof dataStr === 'string' && /^\d{4}-\d{2}/.test(dataStr)) {
    const [ano, mes] = dataStr.slice(0, 7).split('-').map(Number);
    return { ano, mes };
  }
  const d = new Date(dataStr);
  if (isNaN(d.getTime())) return { ano: 0, mes: 0 };
  return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
}

function getFiltrosPadrao() {
  const agora = new Date();
  return {
    ano: agora.getFullYear(),
    mes: agora.getMonth() + 1,
    categoria: null,
    cartao: null,
  };
}

function filtrarTransacoes(transacoes = [], filtros = {}) {
  if (!Array.isArray(transacoes)) return [];
  const { ano, mes, categoria, cartao } = filtros;
  return transacoes.filter((t) => {
    if (!t) return false;
    const { ano: tAno, mes: tMes } = extrairAnoMes(t.data);
    if (ano != null && tAno !== Number(ano)) return false;
    if (mes != null && tMes !== Number(mes)) return false;
    if (categoria != null && t.categoria !== categoria) return false;
    if (cartao != null && t.cartao !== cartao) return false;
    return true;
  });
}

function calcularTotais(transacoesFiltradas = []) {
  if (!Array.isArray(transacoesFiltradas)) {
    return { entradas: 0, saidas: 0, saldo: 0, pctPoupada: 0 };
  }
  let entradas = 0;
  let saidas = 0;
  for (const t of transacoesFiltradas) {
    if (!t) continue;
    const valor = Number(t.valor) || 0;
    if (t.tipo === 'entrada') {
      entradas += valor;
    } else if (t.tipo === 'saida') {
      saidas += valor;
    }
  }
  entradas = Number(entradas.toFixed(2));
  saidas = Number(saidas.toFixed(2));
  const saldo = Number((entradas - saidas).toFixed(2));
  const pctPoupada = entradas > 0 ? Number(((saldo / entradas) * 100).toFixed(2)) : 0;
  return { entradas, saidas, saldo, pctPoupada };
}

function calcularEvolucao12Meses(transacoes = [], anoRef, mesRef) {
  const agora = new Date();
  const aRef = anoRef != null ? Number(anoRef) : agora.getFullYear();
  const mRef = mesRef != null ? Number(mesRef) : agora.getMonth() + 1;

  const resultado = [];
  for (let passo = 11; passo >= 0; passo -= 1) {
    const idxMes = (mRef - 1) - passo;
    const ano = aRef + Math.floor(idxMes / 12);
    const mes = ((idxMes % 12) + 12) % 12 + 1;
    const mesNome = `${NOMES_MESES[mes - 1]}/${String(ano).slice(-2)}`;

    const filtradas = filtrarTransacoes(transacoes, { ano, mes });
    const { entradas, saidas, saldo } = calcularTotais(filtradas);

    resultado.push({
      mesNome,
      entradas,
      saidas,
      saldo,
    });
  }
  return resultado;
}

function calcularRankingCategorias(transacoesFiltradas = [], topN = 10) {
  if (!Array.isArray(transacoesFiltradas)) return [];
  const categoriasMap = new Map();

  const temSaida = transacoesFiltradas.some((t) => t && t.tipo === 'saida');
  const lista = temSaida
    ? transacoesFiltradas.filter((t) => t && t.tipo === 'saida')
    : transacoesFiltradas;

  for (const t of lista) {
    if (!t) continue;
    const cat = t.categoria || 'Sem categoria';
    const val = Math.abs(Number(t.valor) || 0);
    categoriasMap.set(cat, (categoriasMap.get(cat) || 0) + val);
  }

  let totalGeral = 0;
  for (const val of categoriasMap.values()) {
    totalGeral += val;
  }

  const ranking = [];
  for (const [categoria, total] of categoriasMap.entries()) {
    const totalArredondado = Number(total.toFixed(2));
    const pctDoTotal = totalGeral > 0 ? Number(((total / totalGeral) * 100).toFixed(2)) : 0;
    ranking.push({ categoria, total: totalArredondado, pctDoTotal });
  }

  ranking.sort((a, b) => b.total - a.total);
  return ranking.slice(0, topN);
}

function calcularComparativo(transacoes = [], anoRef, mesRef) {
  const agora = new Date();
  const aRef = anoRef != null ? Number(anoRef) : agora.getFullYear();
  const mRef = mesRef != null ? Number(mesRef) : agora.getMonth() + 1;

  const anoAnt = mRef === 1 ? aRef - 1 : aRef;
  const mesAnt = mRef === 1 ? 12 : mRef - 1;

  const anoPassado = aRef - 1;
  const mesPassado = mRef;

  const atual = calcularTotais(filtrarTransacoes(transacoes, { ano: aRef, mes: mRef }));
  const anterior = calcularTotais(filtrarTransacoes(transacoes, { ano: anoAnt, mes: mesAnt }));
  const mesmoMesAnoPassado = calcularTotais(filtrarTransacoes(transacoes, { ano: anoPassado, mes: mesPassado }));

  return { atual, anterior, mesmoMesAnoPassado };
}

function calcularSemafors(totais = {}, categorias = [], cartoes = [], limitesCartoes = {}) {
  const entradas = Number(totais.entradas) || 0;
  const saldo = Number(totais.saldo) || 0;
  const pctPoupada = Number(totais.pctPoupada) || 0;

  let statusSaldo = 'verde';
  if (saldo > 0) {
    statusSaldo = 'verde';
  } else if (saldo >= -0.05 * entradas) {
    statusSaldo = 'amarelo';
  } else {
    statusSaldo = 'vermelho';
  }

  let statusPctPoupada = 'verde';
  if (pctPoupada >= 20) {
    statusPctPoupada = 'verde';
  } else if (pctPoupada >= 5) {
    statusPctPoupada = 'amarelo';
  } else {
    statusPctPoupada = 'vermelho';
  }

  const statusCategorias = (Array.isArray(categorias) ? categorias : []).map((c) => {
    const nome = typeof c === 'string' ? c : (c.categoria || c.nome || 'Categoria');
    const gastoAtual = typeof c === 'object' ? Number(c.gastoAtual ?? c.total ?? c.valor ?? 0) : 0;
    const media = typeof c === 'object' ? Number(c.media ?? c.media3Meses ?? 0) : 0;

    let status = 'verde';
    if (media <= 0) {
      status = gastoAtual > 0 ? 'amarelo' : 'verde';
    } else if (gastoAtual <= 1.10 * media) {
      status = 'verde';
    } else if (gastoAtual <= 1.30 * media) {
      status = 'amarelo';
    } else {
      status = 'vermelho';
    }

    return { categoria: nome, status };
  });

  const statusCartoes = (Array.isArray(cartoes) ? cartoes : []).map((c) => {
    const nome = typeof c === 'string' ? c : (c.cartao || c.nome || 'Cartão');
    const limite = Number(limitesCartoes[nome] ?? (typeof c === 'object' ? c.limite : 0)) || 0;
    const gasto = typeof c === 'object' ? Number(c.gasto ?? c.total ?? c.valor ?? 0) : 0;

    let status = 'verde';
    if (limite <= 0) {
      status = 'verde';
    } else if (gasto > limite) {
      status = 'vermelho';
    } else if (gasto > 0.8 * limite) {
      status = 'amarelo';
    } else {
      status = 'verde';
    }

    return { cartao: nome, status };
  });

  return {
    saldo: statusSaldo,
    pctPoupada: statusPctPoupada,
    categorias: statusCategorias,
    cartoes: statusCartoes,
  };
}

function gerarInsights(total = {}, evolucao = [], ranking = [], comparativo = {}, semafors = {}) {
  const saldo = Number(total.saldo) || 0;
  const entradas = Number(total.entradas) || 0;
  const saidas = Number(total.saidas) || 0;
  const pctPoupada = Number(total.pctPoupada) || 0;

  const conclusoes = [];
  const riscos = [];
  const oportunidades = [];
  const recomendacoes = [];

  conclusoes.push(
    `O saldo do período foi de R$ ${saldo.toFixed(2)}, com R$ ${entradas.toFixed(2)} de receitas e R$ ${saidas.toFixed(2)} de despesas.`
  );
  if (comparativo.anterior && comparativo.atual) {
    const diff = (comparativo.atual.saldo || 0) - (comparativo.anterior.saldo || 0);
    conclusoes.push(
      diff >= 0
        ? `O saldo teve melhora de R$ ${diff.toFixed(2)} em relação ao mês anterior.`
        : `O saldo teve redução de R$ ${Math.abs(diff).toFixed(2)} em relação ao mês anterior.`
    );
  }
  if (ranking.length > 0) {
    conclusoes.push(`A maior categoria de gasto foi "${ranking[0].categoria}" representando ${ranking[0].pctDoTotal}% das despesas.`);
  }

  if (saldo < 0) {
    riscos.push('Risco elevado: despesas superaram as receitas no período (saldo negativo).');
  }
  if (pctPoupada < 5) {
    riscos.push('Margem de segurança financeira baixa (poupança inferior a 5% das receitas).');
  }
  if (Array.isArray(semafors.categorias)) {
    for (const c of semafors.categorias) {
      if (c.status === 'vermelho') {
        riscos.push(`Despesa excessiva na categoria "${c.categoria}" (>30% acima da média histórica).`);
      }
    }
  }
  if (Array.isArray(semafors.cartoes)) {
    for (const cartao of semafors.cartoes) {
      if (cartao.status === 'vermelho') {
        riscos.push(`Cartão de crédito "${cartao.cartao}" ultrapassou o limite definido.`);
      }
    }
  }
  if (riscos.length === 0) {
    riscos.push('Nenhum risco financeiro crítico detectado no período analisado.');
  }

  if (pctPoupada < 20) {
    oportunidades.push('Oportunidade de elevar a taxa de poupança para a faixa recomendada de pelo menos 20%.');
  }
  if (ranking.length > 0) {
    oportunidades.push(`Potencial de economia revisando gastos da categoria líder "${ranking[0].categoria}".`);
  }
  if (oportunidades.length === 0) {
    oportunidades.push('Manter a boa disciplina financeira e alocar excedentes em investimentos.');
  }

  if (saldo < 0) {
    recomendacoes.push('Ajustar despesas variáveis para estancar o déficit e evitar juros.');
  } else if (pctPoupada >= 20) {
    recomendacoes.push('Direcionar a poupança do período para reserva de emergência ou investimentos de longo prazo.');
  } else {
    recomendacoes.push('Definir metas de gastos por categoria para aumentar a capacidade de poupança.');
  }
  recomendacoes.push('Acompanhar os lançamentos semanalmente para evitar surpresas no fechamento do mês.');

  return { conclusoes, riscos, oportunidades, recomendacoes };
}

function verificarDadosInsuficientes(transacoes) {
  if (!Array.isArray(transacoes) || transacoes.length === 0) return true;
  if (transacoes.length < 60) return true;

  const mesesDistintos = new Set();
  for (const t of transacoes) {
    if (t && t.data) {
      const ym = String(t.data).slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(ym)) mesesDistintos.add(ym);
    }
  }
  return mesesDistintos.size < 2;
}

module.exports = {
  getFiltrosPadrao,
  filtrarTransacoes,
  calcularTotais,
  calcularEvolucao12Meses,
  calcularRankingCategorias,
  calcularComparativo,
  calcularSemafors,
  calcularSemaforos: calcularSemafors,
  gerarInsights,
  verificarDadosInsuficientes,
};
