// lib/cortex-custo.js
// Cálculos de agregados de custo usados pelo endpoint /api/custos e pelo painel central.

export function calcularCustoTotalMes(lancamentos) {
  if (!Array.isArray(lancamentos)) return 0;
  return lancamentos.reduce((soma, l) => soma + (Number(l.valor) || 0), 0);
}

function agruparPorPlano(lancamentos) {
  const grupos = {};
  for (const l of lancamentos) {
    const chave = l.planoId || 'sem-plano';
    if (!grupos[chave]) grupos[chave] = [];
    grupos[chave].push(l);
  }
  return grupos;
}

export function calcularCustoMedioPorPlano(lancamentos) {
  const grupos = agruparPorPlano(lancamentos);
  const resultado = {};
  for (const [plano, itens] of Object.entries(grupos)) {
    const total = calcularCustoTotalMes(itens);
    resultado[plano] = itens.length ? total / itens.length : 0;
  }
  return resultado;
}

export function top10ClientesQueMaisGastam(lancamentos) {
  const porCliente = {};
  for (const l of lancamentos) {
    const chave = l.clienteId || l.cliente || 'sem-cliente';
    if (!porCliente[chave]) {
      porCliente[chave] = { cliente: l.cliente || chave, total: 0 };
    }
    porCliente[chave].total += Number(l.valor) || 0;
  }
  return Object.values(porCliente)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
}

export function percentualCustoSobreReceita(custoTotal, receitaTotal) {
  if (!receitaTotal) return 0;
  return (custoTotal / receitaTotal) * 100;
}

export function calcularCustoMedioGeral(lancamentos) {
  if (!Array.isArray(lancamentos) || lancamentos.length === 0) return 0;
  const total = calcularCustoTotalMes(lancamentos);
  return total / lancamentos.length;
}

export function tetoGlobalExcedido(custoTotal, config) {
  if (!config || !config.tetoGlobal) return false;
  return custoTotal > Number(config.tetoGlobal);
}
