/**
 * @file src/chat/handler.ts
 * @brief Manipulador principal para processar mensagens de chat com base nas intenções detectadas.
 */

import { detectIntent, IntentPatterns } from './intents';
import { clearUserMemory, forgetSpecificFact } from '../controllers/memoryController';

export async function handleChatMessage(message: string, userId: string): Promise<string> {
  const intent = detectIntent(message);

  switch (intent) {
    case 'FORGET_FACT': {
      // Extrair o fato específico da mensagem após o padrão de esquecimento
      const factMatch = message.match(IntentPatterns.FORGET_FACT);
      const factToForget = factMatch ? message.substring(factMatch[0].length).trim() : message.trim();
      if (factToForget) {
        try {
          await forgetSpecificFact(userId, factToForget);
          return `Entendido. Removi o fato "${factToForget}" da sua memória.`;
        } catch (error) {
          console.error('Erro ao remover fato:', error);
          return 'Desculpe, ocorreu um erro ao tentar remover o fato. Por favor, tente novamente.';
        }
      }
      return 'Por favor, diga qual fato você gostaria que eu esquecesse.';
    }
    case 'CLEAR_MEMORY':
      try {
        await clearUserMemory(userId);
        return 'Toda a sua memória foi apagada com sucesso. Começaremos do zero!';
      } catch (error) {
        console.error('Erro ao limpar memória:', error);
        return 'Desculpe, ocorreu um erro ao tentar limpar sua memória. Por favor, tente novamente.';
      }
    case 'UNKNOWN':
    default:
      return 'Desculpe, não entendi o que você quis dizer. Posso ajudar de outra forma?';
  }
}
