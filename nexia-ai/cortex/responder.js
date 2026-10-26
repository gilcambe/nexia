/**
 * Módulo responsável por montar o prompt e processar a resposta do Cortex AI.
 * Importa fontes.js e sensibilidade.js para rastrear fontes, validar links,
 * calcular certeza e marcar respostas sensíveis.
 */

const { numerarFontes, marcarFatosComFonte, validarLinks, calcularCerteza } = require('./fontes.js');
const { ehSensivel } = require('./sensibilidade.js');

/**
 * Monta o prompt anexando a lista de fontes numeradas.
 * @param {string} promptBase - Prompt base a ser enviado ao modelo.
 * @param {Array} resultados - Resultados de busca/ferramentas.
 * @returns {string} Prompt com a lista de fontes anexada.
 */
function montarPromptComFontes(promptBase, resultados) {
  const fontesNumeradas = numerarFontes(resultados);

  let prompt = promptBase || '';

  if (fontesNumeradas.length > 0) {
    prompt += '\n\n=== Fontes disponíveis ===';
    fontesNumeradas.forEach((fonte) => {
      prompt += `\n[${fonte.numero}] ${fonte.referenciaFormatada || fonte.titulo || fonte.title || fonte.url || 'Fonte sem título'}`;
    });
    prompt += '\n\nUse as marcações [n] ao citar fatos baseados nessas fontes.';
  }

  return prompt;
}

/**
 * Processa a resposta recebida do modelo:
 * - Marca fatos com fonte
 * - Valida links
 * - Calcula certeza
 * - Acrescenta linha de certeza
 * - Acrescenta aviso de sensibilidade quando aplicável
 * - Retorna objeto com campos fontes, certeza e avisoSensivel para a UI
 *
 * @param {string} resposta - Texto bruto retornado pelo modelo.
 * @param {Array} fontes - Lista de fontes numeradas.
 * @param {string} tipoResposta - Tipo da resposta (factual, tecnico, criativo, geral, etc).
 * @returns {Object} { resposta, fontes, certeza, avisoSensivel }
 */
function processarResposta(resposta, fontes, tipoResposta) {
  const listaFontes = Array.isArray(fontes) ? fontes : [];
  let textoProcessado = resposta || '';

  // Marca fatos com fonte
  textoProcessado = marcarFatosComFonte(textoProcessado, listaFontes);

  // Valida links (remove links que não estão na lista de fontes)
  textoProcessado = validarLinks(textoProcessado, listaFontes);

  // Calcula a certeza
  const certeza = calcularCerteza(listaFontes, tipoResposta);

  // Acrescenta a linha de certeza ao final da resposta
  textoProcessado = textoProcessado.trim() + '\n\nCerteza: ' + certeza;

  // Verifica se é sensível e a certeza é baixa -> acrescenta aviso
  const ehSens = ehSensivel(textoProcessado);
  const avisoSensivel = ehSens && certeza === 'baixa';

  if (avisoSensivel) {
    textoProcessado += '\n\nAviso: este conteúdo aborda temas sensíveis (saúde, direito ou finanças) e a certeza da resposta é baixa. Confirme com um profissional qualificado antes de tomar qualquer decisão.';
  }

  return {
    resposta: textoProcessado,
    fontes: listaFontes,
    certeza,
    avisoSensivel
  };
}

module.exports = {
  montarPromptComFontes,
  processarResposta
};
