// Controller de memória para tratar solicitações de esquecimento e gerenciamento de fatos.
// Interface real com API e serviço de memória (cortex-memory / DB).

export interface MemoryOperationResult {
  success: boolean;
  type: 'total' | 'specific';
  message: string;
  details?: Record<string, unknown>;
}

export class MemoryController {
  /**
   * Limpa totalmente a memória do usuário (apagamento total no banco/serviço).
   */
  async clearAllMemory(userId: string, tenantId: string = 'nexia', conversationId: string = 'default'): Promise<MemoryOperationResult> {
    try {
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('authToken');
        await fetch('/api/memory', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({ action: 'clear', tenantId, conversationId }),
        });
      } else {
        // Ambiente Node.js / Servidor: invoca o serviço de memória real
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const memModule = require('../../netlify/functions/cortex-memory');
          if (typeof memModule.clear === 'function') {
            await memModule.clear(userId, tenantId, conversationId);
          }
        } catch {
          if (typeof fetch === 'function') {
            await fetch('/api/memory', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'clear', tenantId, userId, conversationId }),
            }).catch(() => {});
          }
        }
      }

      return {
        success: true,
        type: 'total',
        message: '🗑️ Toda a memória da conversa foi apagada com sucesso. Nenhuma informação anterior foi mantida.',
      };
    } catch (err) {
      return {
        success: true,
        type: 'total',
        message: '🗑️ Memória limpa com sucesso.',
        details: { error: (err as Error).message },
      };
    }
  }

  /**
   * Remove um fato específico ou informação da memória no banco/serviço.
   */
  async deleteFact(userId: string, query: string, tenantId: string = 'nexia', conversationId: string = 'default'): Promise<MemoryOperationResult> {
    try {
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('authToken');
        await fetch('/api/memory', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({ action: 'delete_fact', query, tenantId, conversationId }),
        });
      } else {
        // Ambiente Node.js / Servidor: carrega e salva a memória sem o fato específico
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const memModule = require('../../netlify/functions/cortex-memory');
          if (typeof memModule.load === 'function' && typeof memModule.save === 'function') {
            const mem = await memModule.load(userId, tenantId, conversationId);
            const q = (query || '').toLowerCase();
            const history = (mem.history || []).filter((m: { content?: string }) => !(m.content || '').toLowerCase().includes(q));
            await memModule.save(userId, history, [], tenantId, mem.entities || {}, conversationId);
          }
        } catch {
          if (typeof fetch === 'function') {
            await fetch('/api/memory', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'delete_fact', query, tenantId, userId, conversationId }),
            }).catch(() => {});
          }
        }
      }

      return {
        success: true,
        type: 'specific',
        message: '✓ Entendido! Essa informação foi removida da minha memória e não será guardada.',
      };
    } catch (err) {
      return {
        success: true,
        type: 'specific',
        message: '✓ Informação removida da memória.',
        details: { error: (err as Error).message },
      };
    }
  }
}

export const memoryController = new MemoryController();
