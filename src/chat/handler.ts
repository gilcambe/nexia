/**
 * @file src/chat/handler.ts
 * @brief Manipulador principal para processar mensagens de chat com base nas intenções detectadas.
 */

import { detectIntent, IntentPatterns } from './intents';
import { clearUserMemory, forgetSpecificFact } from '../controllers/memoryController'; // Supondo que memoryController esteja um nível acima

export async function handleChatMessage(message: string, userId: string): Promise<string> {
  const intent = detectIntent(message);

  switch (intent) {
    case 'FORGET_FACT': {
      const factToForget = message.replace(IntentPatterns.FORGET_FACT, '').trim();
      if (factToForget) {
        await forgetSpecificFact(userId, factToForget);
        return `Entendido. Removi o fato "${factToForget}" da sua memória.`;
      }
      return 'Por favor, diga qual fato você gostaria que eu esquecesse.';
    }
    case 'CLEAR_MEMORY':
      await clearUserMemory(userId);
      return 'Toda a sua memória foi apagada com sucesso. Começaremos do zero!';
    case 'UNKNOWN':
    default:
      return 'Desculpe, não entendi o que você quis dizer. Posso ajudar de outra forma?';
  }
}
