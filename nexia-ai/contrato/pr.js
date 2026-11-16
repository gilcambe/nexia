'use strict';
// Ramo e corpo do PR do executor de contrato (12/11/2026).
// - Ramo nexia/contrato-*: o merge automático (ADR-OPS-02) só olha nexia/*; antes cortex/contrato-* nunca entrava sozinho.
// - "Closes #N": em português ("Fecha #N") o GitHub não fecha a issue; "Fecha #N" fica porque a Central lê (ia-vagas.js).

function ramoDoContrato(numero, agora = Date.now()) {
  const n = Number(numero);
  if (!Number.isInteger(n) || n <= 0) throw new Error('número da issue inválido');
  return `nexia/contrato-${n}-${Number(agora).toString(36)}`;
}

// Melhoria 20: PR aberto desta tarefa (ramo nexia/contrato-<n>-...), ou null. Evita refazer e abrir PR duplicado.
function prAbertoDoContrato(pulls, numero) {
  const n = Number(numero);
  if (!Array.isArray(pulls)) return null;
  return pulls.find(pr => pr && pr.head && typeof pr.head.ref === 'string' && pr.head.ref.startsWith(`nexia/contrato-${n}-`)) || null;
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

module.exports = { ramoDoContrato, corpoDoPr, prAbertoDoContrato };
