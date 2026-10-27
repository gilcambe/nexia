'use strict';
// Adapter para o Workers AI do Cloudflare, exposto via binding global.
// Chama globalThis.__NEXIA_AI__.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', ...)
// e emite chunks no mesmo formato dos demais provedores do model-router:
// objetos { content: string, done: boolean }.
// Se o binding não existir, o provider indica indisponibilidade (lança erro)
// para ser ignorado pelo roteador.
const { ModelError, CODES } = require('../errors');

const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

function binding() {
  return globalThis && globalThis.__NEXIA_AI__;
}

module.exports = {
  id: 'workers-ai-binding',
  available: () => Boolean(binding()),

  /**
   * Executa uma completão de chat no Workers AI.
   * req: { messages, maxTokens, stream, system?, temperature?, signal?, timeoutMs? }
   * Devolve async iterator yieldando { content: string, done: boolean }.
   */
  async *run(req = {}) {
    const b = binding();
    if (!b || typeof b.run !== 'function') {
      throw new ModelError(CODES.UNAVAILABLE, 'Workers AI binding (__NEXIA_AI__) não disponível.', {
        provider: 'workers-ai-binding',
      });
    }

    const messages = Array.isArray(req.messages) ? req.messages : [];
    const max_tokens = req.maxTokens !== undefined ? Number(req.maxTokens) : 4096;

    let stream = req.stream;
    if (stream === undefined) stream = true;

    let res;
    try {
      res = await b.run(MODEL, {
        messages,
        max_tokens,
        stream: true,
      });
    } catch (e) {
      if (e instanceof ModelError) throw e;
      throw new ModelError(CODES.UPSTREAM, `Workers AI binding falhou ao iniciar: ${e && e.message ? e.message : String(e)}`, {
        provider: 'workers-ai-binding',
        model: MODEL,
      });
    }

    try {
      if (stream && res && typeof res[Symbol.asyncIterator] === 'function') {
        for await (const chunk of res) {
          const content = chunk && (chunk.text ?? chunk.content ?? chunk.response ?? '');
          if (content) {
            yield { content: String(content), done: false };
          }
        }
        yield { content: '', done: true };
        return;
      }

      // Resposta não-streaming: emite de uma vez e finaliza.
      const content = res && (res.text ?? res.content ?? res.response ?? '');
      if (content !== undefined && content !== null) {
        yield { content: String(content), done: false };
      }
      yield { content: '', done: true };
    } finally {
      if (res && typeof res.cancel === 'function') {
        try { res.cancel(); } catch { /* já consumido */ }
      }
    }
  },
};
