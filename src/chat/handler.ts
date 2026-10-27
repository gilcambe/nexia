/**
 * @file src/chat/handler.ts
 * @brief Manipulador principal para processar mensagens de chat com base nas intenções detectadas.
 */

import { detectIntent } from './intents';
import { clearUserMemory, forgetSpecificFact } from '../controllers/memoryController'; // Supondo que memoryController esteja um nível acima

export async function handleChatMessage(message: string, userId: string): Promise<string> {
  const intent = detectIntent(message);

  switch (intent) {
    case 'FORGET_FACT':
      // Para 'forget_fact', o bot precisaria de mais contexto para saber qual fato esquecer.
      // Por simplicidade, assumimos que a mensagem contém o fato a ser esquecido ou
      // que o controlador de memória terá uma maneira de inferir.
      // Em um cenário real, isso exigiria um diálogo mais sofisticado.
      const factToForget = message.replace(IntentPatterns.FORGET_FACT, '').trim();
      if (factToForget) {
        await forgetSpecificFact(userId, factToForget);
        return `Entendido. Removi o fato "${factToForget}" da sua memória.`;
      } else {
        return 'Por favor, diga qual fato você gostaria que eu esquecesse.';
      }
    case 'CLEAR_MEMORY':
      await clearUserMemory(userId);
      return 'Toda a sua memória foi apagada com sucesso. Começaremos do zero!';
    case 'UNKNOWN':
    default:
      // Aqui você pode adicionar a lógica padrão de tratamento de chat
      return 'Desculpe, não entendi o que você quis dizer. Posso ajudar de outra forma?';
  }
}
