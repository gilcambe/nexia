const { iasAgora, carregar } = require('./ias-agora');

function resumoDia(itens, ias) {
  // Mock ou implementação simples baseada no que o sistema usa de resumo
  return `Resumo: ${ias.filter(i => i.situacao === 'ativa').length} ativas, ${itens.length} tarefas hoje.`;
}

module.exports = { iasAgora, carregar, resumoDia };
