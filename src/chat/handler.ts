/**
 * @file src/chat/handler.ts
 * @brief Manipulador principal para processar mensagens de chat com base nas intenções detectadas.
 */

import { detectIntent, extractFact } from './intents';
import { clearUserMemory, forgetSpecificFact } from '../controllers/memoryController';

export async function handleChatMessage(message: string, userId: string): Promise<string> {
  const intent = detectIntent(message);

  switch (intent) {
    case 'FORGET_FACT': {
      const factToForget = extractFact(message);
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

export async function handleMemoryAction(action: string, userId: string, data?: any): Promise<string> {
  try {
    switch (action) {
      case 'clear':
        await clearUserMemory(userId);
        return 'Toda a sua memória foi apagada com sucesso. Começaremos do zero!';
      case 'forget':
        if (!data?.fact) return 'Por favor, diga qual fato você gostaria que eu esquecesse.';
        await forgetSpecificFact(userId, data.fact);
        return `Entendido. Removi o fato "${data.fact}" da sua memória.`;
      default:
        return 'Ação de memória não reconhecida.';
    }
  } catch (error) {
    console.error('Erro na ação de memória:', error);
    return 'Desculpe, ocorreu um erro ao processar sua solicitação de memória. Por favor, tente novamente.';
  }
}
