import { ctx } from 'cloudflare:workers';
import { memoryService } from '../services/memoryService';
import { extractFacts } from '../services/factExtractor';

export async function handleResponse(responseText: string, userId: string, conversationId: string): Promise<void> {
  const fatos = await extractFacts(responseText, 3);
  for (const fato of fatos) {
    await memoryService.upsertFact(userId, conversationId, {
      ...fato,
      usado_em: new Date().toISOString(),
    });
  }
  if (fatos.length) {
    ctx.waitUntil(Promise.resolve());
  }
}
