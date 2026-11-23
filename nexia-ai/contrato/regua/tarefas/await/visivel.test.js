'use strict';

/**
 * Teste visível: processarToken deve aguardar a Promise de validarToken.
 *
 * O módulo exporta uma função async que recebe uma solução com
 * processarToken(token, validarToken) e lança erro se a solução não usar await.
 */

async function validarToken(token) {
  return token === 'token-valido';
}

module.exports = async function runVisivel(solucao) {
  const resultado = await solucao.processarToken('token-valido', validarToken);

  if (resultado !== true) {
    throw new Error(
      'processarToken não retornou true para token válido (provavelmente falta await na Promise de validarToken)'
    );
  }
};
