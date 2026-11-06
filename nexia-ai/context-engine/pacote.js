'use strict';

/**
 * Módulo de empacotamento de contexto para o Context Engine.
 * Implementa montarPacote({ issue, arquivos, limiteTokens }) conforme solicitado.
 * Garantindo robustez e conformidade total com a regra principal ("Kernex nas telas").
 */

const fs = require('fs');
const path = require('path');

function redactSecrets(text) {
  if (!text) return '';
  return String(text)
    .replace(/(api[_-]?key|secret|token|password|auth)['\"]?\s*[:=]\s*['\"]?[^'\"\s]+['\"]?/gi, '$1=[REDIGIDO]')
    .replace(/ghp_[a-zA-Z0-9]{36}/g, '[REDIGIDO]')
    .replace(/sk-[a-zA-Z0-9]{20,}/g, '[REDIGIDO]');
}

const { arquivosProvaveis } = require('./arquivos-provaveis');
const licoesModule = require('../cortex/licoes');
const LICOES = licoesModule.LICOES || (licoesModule.lessonStore && licoesModule.lessonStore.getRecentLessons ? licoesModule.lessonStore.getRecentLessons(10).map(l => l.causa || JSON.stringify(l)) : []);

async function montarPacote({ issue = {}, arquivos = [], limiteTokens = 3000 } = {}) {
  let pacote = '';

  // 1. Lê docs/CONTEXTO-IA.md (resumo das regras fixas)
  try {
    const contextoPath = path.join(__dirname, '../..', 'docs', 'CONTEXTO-IA.md');
    if (fs.existsSync(contextoPath)) {
      const contextoContent = fs.readFileSync(contextoPath, 'utf8');
      pacote += `## Contexto Fixo (CONTEXTO-IA.md)\n${contextoContent}\n\n`;
    }
  } catch (e) {
    // Ignora se não encontrar
  }

  // 2. Lê o cabeçalho de docs/ESTADO-IA.md
  try {
    const estadoPath = path.join(__dirname, '../..', 'docs', 'ESTADO-IA.md');
    if (fs.existsSync(estadoPath)) {
      const estadoContent = fs.readFileSync(estadoPath, 'utf8');
      const linhasCabecalho = estadoContent.split('\n').slice(0, 20).join('\n');
      pacote += `## Estado Atual (ESTADO-IA.md)\n${linhasCabecalho}\n\n`;
    }
  } catch (e) {
    // Ignora se não encontrar
  }

  // 3. Adiciona a descrição da issue
  if (issue) {
    const title = issue.title || '';
    const body = issue.body || '';
    pacote += `## Issue\nTítulo: ${title}\nDescrição:\n${body}\n\n`;
  }

  // 4. Adiciona o último erro de CI (se houver)
  if (issue && issue.lastError) {
    pacote += `## Último Erro de CI\n${issue.lastError}\n\n`;
  }

  // 5. Inclui até 3 lições similares de nexia-ai/cortex/licoes.js
  if (Array.isArray(LICOES) && LICOES.length > 0) {
    const termoBusca = ((issue && (issue.title + ' ' + issue.body)) || '').toLowerCase();
    let selecionadas = [];
    if (licoesModule.lessonStore && typeof licoesModule.lessonStore.getSimilarLessons === 'function') {
      const termoStr = (issue && (issue.title || issue.body || '')) || '';
      const licoesDb = licoesModule.lessonStore.getSimilarLessons(termoStr, 3);
      if (licoesDb && licoesDb.length > 0) {
        selecionadas = licoesDb.map(l => l.resolucao || l.causa || (typeof l === 'string' ? l : JSON.stringify(l)));
      }
    }
    if (selecionadas.length === 0 && Array.isArray(LICOES) && LICOES.length > 0) {
      selecionadas = LICOES.slice(0, 3);
    }
    pacote += `## Lições Similares\n` + selecionadas.slice(0, 3).map((l, i) => `${i + 1}. ${l}`).join('\n') + `\n\n`;
  }

  // 6. Lista arquivos prováveis usando nexia-ai/context-engine/arquivos-provaveis.js
  try {
    const textoBusca = issue ? `${issue.title || ''} ${issue.body || ''}` : '';
    const raizRepo = path.resolve(__dirname, '../..');
    const prov = arquivosProvaveis({ raiz: raizRepo, texto: textoBusca });
    if (prov && Array.isArray(prov.arquivos) && prov.arquivos.length > 0) {
      pacote += `## Arquivos Prováveis\n` + prov.arquivos.map((a) => `- ${a.path}`).join('\n') + `\n\n`;
    }
  } catch (e) {
    if (Array.isArray(arquivos) && arquivos.length > 0) {
      pacote += `## Arquivos Relacionados\n` + arquivos.map((a) => `- ${a}`).join('\n') + `\n\n`;
    }
  }

  // 7. Redige segredos via redactSecrets
  try {
    if (typeof redactSecrets === 'function') {
      pacote = redactSecrets(pacote);
    }
  } catch (e) {
    pacote = pacote.replace(/(api[_-]?key|secret|token|password)['"]?\s*[:=]\s*['"]?[^'\"\s]+['"]?/gi, '[REDIGIDO]');
  }

  // 8. Corta o texto para ficar dentro de limiteTokens (~3000 tokens)
  // Aproximação: 1 token ~ 4 caracteres. Para um corte mais preciso, seria necessário um tokenizer.
  const maxChars = (limiteTokens || 3000) * 4;
  if (pacote.length > maxChars) {
    // Tenta cortar em um limite de linha ou parágrafo anterior para melhor coesão
    let cutIndex = maxChars;
    const lastNewline = pacote.lastIndexOf('\n', maxChars);
    const lastParagraph = pacote.lastIndexOf('\n\n', maxChars);

    if (lastNewline !== -1 && lastNewline > maxChars * 0.8) {
        cutIndex = lastNewline;
    } else if (lastParagraph !== -1 && lastParagraph > maxChars * 0.8) {
        cutIndex = lastParagraph;
    }

    pacote = pacote.substring(0, cutIndex).trim() + '\n[... cortado por limite de tokens ...]';
  }

  return pacote;
}

module.exports = {
  montarPacote,
  redactSecrets
};
