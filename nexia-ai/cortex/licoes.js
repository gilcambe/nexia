/**
 * Lições do Cortex em CommonJS
 */

const LICOES = [
  "modelos grátis ignoram especificação longa, quebre em passos pequenos",
  "use arquivos novos em vez de editar trechos",
  "sempre await em funções assíncronas",
  "não invente funções que não existem, leia o arquivo antes",
  "cite só caminhos que existem"
];

function licoesParaPrompt() {
  return LICOES.map((licao, index) => `${index + 1}. ${licao}`).join('\n');
}

module.exports = {
  LICOES,
  licoesParaPrompt
};
