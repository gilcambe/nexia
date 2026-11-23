function lerExportacao(texto) {
  if (!texto || typeof texto !== 'string') return [];
  try {
    const parsed = JSON.parse(texto);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.executions)) {
      return parsed.executions;
    }
  } catch (e) {
    // Retorna vazio em caso de JSON inválido
  }
  return [];
}

function calcularPercentil(valores, p) {
  if (!valores.length) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  const index = Math.ceil(p * ordenados.length) - 1;
  const clampedIndex = Math.max(0, Math.min(index, ordenados.length - 1));
  return ordenados[clampedIndex];
}

function analisarConsumo(execucoes) {
  const lista = Array.isArray(execucoes) ? execucoes : [];
  const total = lista.length;

  let tokensEntrada = 0;
  let tokensSaida = 0;
  let custoUsd = 0;
  let custoDesconhecido = 0;
  let tokensEmFalhas = 0;
  let cachedCount = 0;
  let cachedTotalCount = 0;

  const porIntencao = {};
  const latencias = [];
  const todasExecucoesTokens = [];

  for (const exec of lista) {
    const usage = exec && exec.usage ? exec.usage : {};
    const input = Number(usage.input_tokens) || 0;
    const output = Number(usage.output_tokens) || 0;
    const costMicros = Number(usage.cost_usd_micros) || 0;
    const totalTokens = input + output;

    tokensEntrada += input;
    tokensSaida += output;
    custoUsd += costMicros / 1e6;

    if (usage.cost_known === false) {
      custoDesconhecido += 1;
    }

    const intent = exec && exec.intent ? String(exec.intent) : 'desconhecido';
    if (!porIntencao[intent]) {
      porIntencao[intent] = { n: 0, tokens: 0, custoUsd: 0 };
    }
    porIntencao[intent].n += 1;
    porIntencao[intent].tokens += totalTokens;
    porIntencao[intent].custoUsd += costMicros / 1e6;

    if (exec && exec.started_at && exec.finished_at) {
      const inicio = new Date(exec.started_at).getTime();
      const fim = new Date(exec.finished_at).getTime();
      if (!isNaN(inicio) && !isNaN(fim) && fim >= inicio) {
        latencias.push(fim - inicio);
      }
    }

    const status = exec && exec.status ? String(exec.status).toLowerCase() : '';
    if (status === 'failed' || status === 'falha') {
      tokensEmFalhas += totalTokens;
    }

    if (exec && typeof exec.cached === 'boolean') {
      cachedTotalCount += 1;
      if (exec.cached === true) {
        cachedCount += 1;
      }
    }

    todasExecucoesTokens.push({
      id: exec && exec.id ? exec.id : null,
      intent: intent,
      tokens: totalTokens,
    });
  }

  const p50 = calcularPercentil(latencias, 0.50);
  const p95 = calcularPercentil(latencias, 0.95);
  let max = null;
  if (latencias.length > 0) {
    max = Math.max(...latencias);
  }

  todasExecucoesTokens.sort((a, b) => b.tokens - a.tokens);
  const maiores = todasExecucoesTokens.slice(0, 10);

  let cacheHitRate = null;
  if (cachedTotalCount > 0) {
    cacheHitRate = cachedCount / cachedTotalCount;
  }

  return {
    total,
    medidas: {
      tokensEntrada,
      tokensSaida,
      custoUsd,
      custoDesconhecido,
    },
    porIntencao,
    latencia: {
      p50,
      p95,
      max,
    },
    desperdicío: {
      tokensEmFalhas,
      execucoesFalhas: lista.filter(e => {
        const s = e && e.status ? String(e.status).toLowerCase() : '';
        return s === 'failed' || s === 'falha';
      }).length,
    },
    maiores,
    cacheHitRate,
  };
}

module.exports = {
  lerExportacao,
  analisarConsumo,
};
