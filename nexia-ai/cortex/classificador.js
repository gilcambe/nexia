'use strict';
// Classificador de Dificuldade e Elegibilidade de Cache (Q4 - Issue #1632)
// Classifica sem IA para selecionar a classe de modelo mais rápida (fast) para perguntas simples
// ou modelo forte (reasoning/coding) para perguntas difíceis.
// Garante que cache de 24h só é usado em perguntas gerais (sem histórico, sem PII/dados pessoais).

const PII_RE = {
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
  cpf: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/,
  telefone: /\b(?:\+55\s?)?(?:\(?\d{2}\)?\s?)?9?\d{4}[-.\s]?\d{4}\b/,
  pessoal: /\b(?:meu|minha|meus|minhas)\s+(?:nome|email|e-mail|conta|senha|pedido|dados|cpf|telefone|celular|cart[aã]o|endere[cç]o)\b/i,
};

const PALAVRAS_DIFICEIS = [
  'funcao', 'função', 'refatorar', 'arquitetura', 'banco de dados', 'firestore', 'algoritmo',
  'raciocinio', 'raciocínio', 'contrato', 'analise', 'análise', 'explique em detalhes', 'modulo',
  'módulo', 'codigo', 'código', 'implemente', 'corrija', 'bug', 'erro', 'stack trace', 'exception',
  'interface', 'componente', 'endpoint', 'webhook', 'schema', 'query', 'sql', 'deploy', 'pipeline'
];

const TEM_CODIGO = /(```|function\s+\w+|class\s+\w+|const\s+\w+\s*=|let\s+\w+\s*=|var\s+\w+\s*=|import\s+.*from|def\s+\w+|public\s+class|<[a-z0-9-]+>)/i;

/**
 * Classifica se uma pergunta é 'simples' ou 'dificil' sem chamar LLM.
 * @param {string} message
 * @param {object} [options]
 * @returns {'simples' | 'dificil'}
 */
function classificarDificuldade(message, options = {}) {
  const msg = String(message || '').trim();
  if (!msg) return 'simples';

  // Anexo, arquivo, RAG ou requisição de código explícita -> difícil
  if (options.ragEnabled || options.hasFiles || options.hasAttachments || options.code_request || options.image_request) {
    return 'dificil';
  }

  // Presença de blocos ou síntaxe de código -> difícil
  if (TEM_CODIGO.test(msg)) {
    return 'dificil';
  }

  // Texto longo (> 300 caracteres) -> difícil
  if (msg.length > 300) {
    return 'dificil';
  }

  const msgNorm = msg.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Palavras-chave técnicas/complexas -> difícil
  for (const p of PALAVRAS_DIFICEIS) {
    const pNorm = p.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (msgNorm.includes(pNorm)) {
      return 'dificil';
    }
  }

  // Saudações, contas simples, definições curtas ou perguntas diretas de tamanho pequeno -> simples
  return 'simples';
}

/**
 * Determina se a pergunta pode usar o cache geral de 24h.
 * NUNCA usa cache se houver histórico prévio, dados pessoais/PII ou contexto de usuário.
 * @param {string} message
 * @param {object} [options]
 * @returns {boolean}
 */
function podeUsarCache(message, options = {}) {
  const msg = String(message || '').trim();
  if (!msg) return false;

  // 1. Se houver histórico prévio da conversa, NUNCA usa cache
  const historyLen = options.historyLength || (options.context && options.context.length) || 0;
  if (historyLen > 0) {
    return false;
  }

  // 2. Se houver contexto de projeto específico do usuário/tenant ou contexto de aprendizado, NUNCA usa cache
  if (options.projectMode === 'context' || options.learningCtx || options.hasPersonalContext) {
    return false;
  }

  // 3. Forçar sem cache se explicitamente pedido
  if (options.forceNoCache || options.noCache) {
    return false;
  }

  // 4. Verificar dados pessoais / PII
  if (PII_RE.email.test(msg) || PII_RE.cpf.test(msg) || PII_RE.pessoal.test(msg)) {
    return false;
  }

  return true;
}

module.exports = {
  classificarDificuldade,
  podeUsarCache,
};
