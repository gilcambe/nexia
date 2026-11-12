'use strict';
// Ramo e corpo do PR do executor de contrato (12/11/2026).
// - Ramo nexia/contrato-*: o merge automático (ADR-OPS-02) só olha nexia/*; antes cortex/contrato-* nunca entrava sozinho.
// - "Closes #N": em português ("Fecha #N") o GitHub não fecha a issue; "Fecha #N" fica porque a Central lê (ia-vagas.js).

function ramoDoContrato(numero, agora = Date.now()) {
  const n = Number(numero);
  if (!Number.isInteger(n) || n <= 0) throw new Error('número da issue inválido');
  return `nexia/contrato-${n}-${Number(agora).toString(36)}`;
}

function corpoDoPr({ numero, teste, modelo, tentativas, seg, arquivos, hist = '' }) {
  return [
    `Fecha #${numero}`,
    `Closes #${numero}`,
    '',
    `Entregue pelo executor de contrato: o teste de aceitação \`${teste}\` falhava antes e passa agora.`,
    `IA: ${modelo}; ${tentativas} tentativa(s); ${seg} s.`,
    `Arquivos: ${(arquivos || []).map(f => `\`${f}\``).join(', ')}`,
    '',
    hist,
  ].join('\n');
}

module.exports = { ramoDoContrato, corpoDoPr };
