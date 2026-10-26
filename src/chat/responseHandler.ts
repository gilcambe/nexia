import { memoryService } from '../services/memoryService';
import { extractFacts } from '../services/factExtractor';

export async function handleResponse(responseText: string, userId: string, conversationId: string, ctx?: { waitUntil: (p: Promise<unknown>) => void }): Promise<void> {
  if (ctx) {
    ctx.waitUntil(
      (async () => {
        try {
          const fatos = await extractFacts(responseText, 3);
          if (fatos.length) {
            await Promise.all(
              fatos.map(fato =>
                memoryService.upsertFact(userId, conversationId, {
                  ...fato,
                  usado_em: new Date().toISOString(),
                })
              )
            );
          }
        } catch (error) {
          console.error('Erro na persistência de fatos:', error);
          // Não bloqueia o fluxo principal, apenas loga o erro
        }
      })()
    );
  }
}
