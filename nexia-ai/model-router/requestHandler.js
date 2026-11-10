const { handleRetryOrFallback, classifyError } = require('../../src/retryStrategy');

async function handleRequestWithFallback(requestFn, providers = [], options = {}) {
  let lastError = null;
  const maxAttempts = options.maxAttempts || 3;

  for (let i = 0; i < providers.length || i < maxAttempts; i++) {
    const currentProvider = providers[i % providers.length];
    try {
      const startTime = Date.now();
      const result = await requestFn(currentProvider);
      return result;
    } catch (err) {
      lastError = err;
      const classification = classifyError(err);
      
      if (classification.type === 'permanent') {
        console.log(`[RequestHandler] Permanent error encountered (${classification.subtype}). Aborting provider chain.`);
        throw err;
      }

      const headers = err?.headers || err?.response?.headers || {};
      const retryResult = await handleRetryOrFallback({
        error: err,
        attempt: i + 1,
        maxAttempts,
        headers,
        onFallback: ({ backoff }) => {
          console.log(`fallback to provider ${providers[(i + 1) % providers.length] || 'next'} after ${backoff} ms`);
        }
      });

      if (!retryResult.shouldRetry) {
        throw err;
      }
    }
  }

  throw lastError;
}

module.exports = {
  handleRequestWithFallback
};
