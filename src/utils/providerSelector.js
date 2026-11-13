'use strict';
/**
 * src/utils/providerSelector.js
 * Seleção de providers por tamanho (pequena, média, grande), checagem de cotas,
 * disjuntores, flag de treino com dados e exclusão de degraus pagos sem tetos.
 */
const { tetosConfigurados } = require('../config/limits');

function selecionarProvider(tamanho, options = {}) {
  const { providers = [], placar, quotas = {}, env = process.env } = options;
  const comTetos = tetosConfigurados(env);

  return providers.filter(p => {
    const id = p.id || p.provider || p;
    const idStr = typeof id === 'string' ? id : (id.provider || '');

    // 1. Excluir degrau pago (RESERVA_*) quando tetos não definidos
    if (idStr.toUpperCase().startsWith('RESERVA_') && !comTetos) {
      return false;
    }

    // 2. Provedor Jules nunca é o primeiro (ou filtrado se houver alternativas)
    if (idStr.toLowerCase().includes('jules') && providers.length > 1 && providers[0] === p) {
      return false;
    }

    // 3. Disjuntor aberto ou bloqueado no placar
    if (placar && typeof placar.bloqueado === 'function' && placar.bloqueado({ provider: idStr })) {
      return false;
    }

    // 4. Sem cota disponível
    if (quotas[idStr] && quotas[idStr].esgotada) {
      return false;
    }

    return true;
  });
}

module.exports = { selecionarProvider };
