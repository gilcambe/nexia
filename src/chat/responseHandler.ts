import { extractFacts } from '../services/factExtractor.ts';
import type { FactExtractorOptions } from '../services/factExtractor.ts';
import { saveFacts } from '../services/memoryService.ts';
import type { DurableFactRecord } from '../services/memoryService.ts';

export interface PostResponseContext {
  responseText: string;
  userMessage?: string;
  tenantId?: string;
  userId?: string;
  conversationId?: string;
  waitUntil?: (promise: Promise<any>) => void;
  extractorOptions?: FactExtractorOptions;
  dbOverride?: any;
}

export interface PostResponseResult {
  asyncTriggered: boolean;
  factsPromise: Promise<DurableFactRecord[]>;
}

/**
 * Handles post-response processing asynchronously.
 * Triggers fact extraction using Groq llama-3.1-8b-instant (via extractFacts),
 * filters sensitive info, and saves up to 3 durable facts with 'usado_em' timestamp.
 * Uses ctx.waitUntil if provided to avoid blocking response stream/delivery.
 */
export function handlePostResponse(context: PostResponseContext): PostResponseResult {
  const {
    responseText,
    userMessage = '',
    tenantId = 'nexia',
    userId = 'anon',
    conversationId = 'default',
    waitUntil,
    extractorOptions,
    dbOverride,
  } = context;

  const asyncProcess = (async (): Promise<DurableFactRecord[]> => {
    try {
      const extracted = await extractFacts(responseText, userMessage, extractorOptions);
      if (!extracted || extracted.length === 0) return [];

      const saved = await saveFacts(extracted, {
        tenantId,
        userId,
        conversationId,
        dbOverride,
      });

      return saved;
    } catch (err) {
      console.warn('[ResponseHandler] Error in post-response fact extraction:', err);
      return [];
    }
  })();

  if (typeof waitUntil === 'function') {
    try {
      waitUntil(asyncProcess);
    } catch (err) {
      console.warn('[ResponseHandler] waitUntil invocation warning:', err);
    }
  }

  return {
    asyncTriggered: true,
    factsPromise: asyncProcess,
  };
}
