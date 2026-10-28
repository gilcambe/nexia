// Handler de mensagens do chat Cortex.
// Processa mensagens de entrada, identifica intenção de esquecimento e aciona o controller de memória.

import { detectForgetIntent } from './intents';
import { memoryController, MemoryOperationResult } from '../controllers/memoryController';

export interface ChatHandlerResponse {
  handled: boolean;
  isForget: boolean;
  reply: string;
  result?: MemoryOperationResult;
}

export async function handleChatMessage(
  message: string,
  userId: string = 'user',
  tenantId: string = 'nexia',
  conversationId: string = 'default'
): Promise<ChatHandlerResponse> {
  const intent = detectForgetIntent(message);

  if (intent.isForget) {
    if (intent.type === 'total') {
      const res = await memoryController.clearAllMemory(userId, tenantId, conversationId);
      return {
        handled: true,
        isForget: true,
        reply: res.message,
        result: res,
      };
    } else {
      const res = await memoryController.deleteFact(userId, message, tenantId, conversationId);
      return {
        handled: true,
        isForget: true,
        reply: res.message,
        result: res,
      };
    }
  }

  return {
    handled: false,
    isForget: false,
    reply: '',
  };
}
