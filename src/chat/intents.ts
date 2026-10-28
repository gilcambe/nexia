/**
 * @file src/chat/intents.ts
 * @brief Definições de intenções e expressões regulares para o processamento de mensagens do chat.
 */

export const IntentPatterns = {
  FORGET_FACT: /(esqueça isso|não guarde|remover este fato|apagar este dado|apagar isso|apagar este|esquecer isso|esquecer este|remover isso|remover este)/i,
  CLEAR_MEMORY: /(apagar tudo|limpar toda a memória|resetar minha memória|limpar tudo|zerar memória|esqueça tudo|não guarde nada)/i,
};

export function extractFact(message: string): string | null {
  const match = message.match(IntentPatterns.FORGET_FACT);
  if (!match) return null;
  const fact = message.substring(match.index + match[0].length).trim();
  return fact || null;
}

export type Intent = 'FORGET_FACT' | 'CLEAR_MEMORY' | 'UNKNOWN';

export function detectIntent(message: string): Intent {
  if (IntentPatterns.FORGET_FACT.test(message)) {
    return 'FORGET_FACT';
  }
  if (IntentPatterns.CLEAR_MEMORY.test(message)) {
    return 'CLEAR_MEMORY';
  }
  return 'UNKNOWN';
}
