'use strict';

/**
 * Teste oculto: valida tokens válidos e inválidos através de validarToken,
 * que retorna uma Promise. A solução correta usa await; a incorreta ignora
 * a assincronicidade e aceita qualquer token.
 */

async function validarToken(token) {
  return token === 'token-valido';
}

module.exports = async function runOculto(solucao) {
  // Token válido deve ser aceito
  const valido = await solucao.processarToken('token-valido', validarToken);
  if (valido !== true) {
    throw new Error('token válido não foi aceito');
  }

  // Token inválido deve ser rejeitado
  const invalido = await solucao.processarToken('token-invalido', validarToken);
  if (invalido !== false) {
    throw new Error('token inválido não foi rejeitado');
  }
};
