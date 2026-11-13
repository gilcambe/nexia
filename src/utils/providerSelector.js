'use strict';

/**
 * Selecionador inteligente de provedores com base em tamanho, cotas e regras de negócio.
 */
function selectProviders(descs, req, options = {}) {
  const env = options.env || process.env;
  const placar = options.placar || (tryGetPlacar());
  const paidAllowed = env.NEXIA_PAID_ALLOWED === 'true' || env.NEXIA_PAID_TETOS_CONFIGURADOS;

  const promptText = (req && req.messages ? req.messages.map(m => m.content || '').join(' ') : '') || req?.system || '';
  const isSensitive = req?.sensivel === true || req?.treina_com_dados === 'não';

  const filtered = (descs || []).filter(d => {
    if (!d) return false;
    // Excluir degraus pagos (RESERVA_*) se tetos não definidos
    const isPaid = String(d.provider).toUpperCase().includes('RESERVA') || String(d.model).toUpperCase().includes('PAID');
    if (isPaid && !paidAllowed) return false;

    // Se dados sensíveis, evitar provedores que treinam com dados (ex: alguns externos, garantir que respeite)
    if (isSensitive && d.provider === 'jules') {
      return false;
    }

    // Verificar disjuntor / cota pelo placar, se disponível
    if (placar && typeof placar.bloqueado === 'function' && placar.bloqueado(d)) {
      return false;
    }

    return true;
  });

  // Regra: provider Jules nunca deve ser o primeiro da lista, a menos que seja a única opção
  const sorted = [...filtered].sort((a, b) => {
    if (a.provider === 'jules' && b.provider !== 'jules') return 1;
    if (a.provider !== 'jules' && b.provider === 'jules') return -1;
    return 0;
  });

  return sorted;
}

function tryGetPlacar() {
  try {
    return require('../../nexia-ai/model-router/cota').getPlacar();
  } catch {
    return null;
  }
}

module.exports = {
  selectProviders,
};
