const fs = require('fs');
const path = require('path');
const { redactSecrets } = require('./redactSecrets');
const { arquivosProvaveis } = require('./arquivos-provaveis');
const { LICOES } = require('../../cortex/licoes');

async function montarPacote({ issue, arquivos, limiteTokens }) {
  let pacote = '';

  // Adiciona contexto fixo
  const contextoIA = fs.readFileSync(path.join(__dirname, '../../../docs/CONTEXTO-IA.md'), 'utf8');
  pacote += `## Contexto\n${contextoIA}\n\n`;

  // Adiciona estado atual
  const estadoIA = fs.readFileSync(path.join(__dirname, '../../../docs/ESTADO-IA.md'), 'utf8').split('\n').slice(0, 10).join('\n');
  pacote += `## Estado\n${estadoIA}\n\n`;

  // Adiciona descrição da issue
  pacote += `## Issue\n${issue.title}\n${issue.body}\n\n`;

  // Adiciona último erro de CI
  if (issue.lastError) {
    pacote += `## Último Erro de CI\n${issue.lastError}\n\n`;
  }

  // Adiciona lições similares
  const liçõesSimilares = LICOES.filter(licao =>
    issue.body.toLowerCase().includes(licao.toLowerCase())
  ).slice(0, 3);
  if (liçõesSimilares.length > 0) {
    pacote += `## Lições Similares\n${liçõesSimilares.join('\n')}\n\n`;
  }

  // Lista arquivos prováveis
  const arquivosProváveis = arquivosProvaveis(issue.title + ' ' + issue.body);
  pacote += `## Arquivos Prováveis\n${arquivosProváveis.join('\n')}\n\n`;

  // Redige segredos
  pacote = redactSecrets(pacote);

  // Corta para ficar dentro do limite de tokens
  if (pacote.length > limiteTokens) {
    pacote = pacote.substring(0, limiteTokens);
  }

  return pacote;
}
  let pacote = '';

  // Adiciona contexto fixo
  const contextoIA = fs.readFileSync(path.join(__dirname, '../../../docs/CONTEXTO-IA.md'), 'utf8');
  pacote += `## Contexto\n${contextoIA}\n\n`;

  // Adiciona estado atual
  const estadoIA = fs.readFileSync(path.join(__dirname, '../../../docs/ESTADO-IA.md'), 'utf8');
  pacote += `## Estado\n${estadoIA}\n\n`;

  // Adiciona descrição da issue
  pacote += `## Issue\n${issue.title}\n${issue.body}\n\n`;

  // Adiciona último erro de CI
  if (issue.lastError) {
    pacote += `## Último Erro de CI\n${issue.lastError}\n\n`;
  }

  // Adiciona lições similares
  const liçõesSimilares = LICOES.filter(licao =>
    issue.body.toLowerCase().includes(licao.toLowerCase())
  ).slice(0, 3);
  if (liçõesSimilares.length > 0) {
    pacote += `## Lições Similares\n${liçõesSimilares.join('\n')}\n\n`;
  }

  // Lista arquivos prováveis
  const arquivosProváveis = arquivosProvaveis(issue.title + ' ' + issue.body);
  pacote += `## Arquivos Prováveis\n${arquivosProváveis.join('\n')}\n\n`;

  // Redige segredos
  pacote = redactSecrets(pacote);

  // Corta para ficar dentro do limite de tokens
  if (pacote.length > limiteTokens) {
    pacote = pacote.substring(0, limiteTokens);
  }

  return pacote;
}

export { montarPacote }; // Corrigido para CommonJS
