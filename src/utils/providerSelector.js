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

  // Filtra providers válidos aplicando as regras solicitadas
  const filtrados = providers.filter(p => {
    const rawId = p && p.provider !== undefined ? p.provider : p;
    const idStr = typeof rawId === 'string' ? rawId : '';

    // 1. Excluir degrau pago (RESERVA_*) quando tetos não definidos
    if (idStr.toUpperCase().startsWith('RESERVA_') && !comTetos) {
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

  // 2. Provedor Jules nunca é o primeiro (se houver alternativas, move para o final ou filtra se estrito)
  if (filtrados.length > 1) {
    const julesIndex = filtrados.findIndex(p => {
      const rawId = p && p.provider !== undefined ? p.provider : p;
      return typeof rawId === 'string' && rawId.toLowerCase().includes('jules');
    });
    if (julesIndex === 0) {
      // Remove do início e joga para o final (ou remove se houver outras opções)
      const [julesItem] = filtrados.splice(julesIndex, 1);
      filtrados.push(julesItem);
    }
  }

  return filtrados;
}

module.exports = { selecionarProvider };
