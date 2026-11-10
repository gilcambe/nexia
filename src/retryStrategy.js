/**
 * Estratégia de Retry e Fallback para Erros de API (HTTP 429, 5xx, etc.)
 */

function parseRetryAfter(headerValue) {
  if (!headerValue) return null;
  const seconds = parseInt(headerValue, 10);
  if (!isNaN(seconds)) {
    return seconds * 1000;
  }
  const dateMs = Date.parse(headerValue);
  if (!isNaN(dateMs)) {
    const delta = dateMs - Date.now();
    return delta > 0 ? delta : 0;
  }
  return null;
}

function classifyError(err) {
  const status = err?.status || err?.statusCode || err?.details?.status || err?.response?.status;
  const message = (err?.message || '').toLowerCase();
  
  if (status === 429 || message.includes('too many requests') || message.includes('rate limit')) {
    return { type: 'transient', subtype: 'rate_limit', status: 429 };
  }
  if (status === 503 || status === 502 || status === 504 || message.includes('overloaded') || message.includes('high demand')) {
    return { type: 'transient', subtype: 'server_error', status: status || 503 };
  }
  if (status === 401 || status === 403) {
    return { type: 'permanent', subtype: 'auth', status };
  }
  if (status === 404) {
    return { type: 'permanent', subtype: 'not_found', status };
  }
  if (status === 413 || message.includes('too large') || message.includes('tokens_limit_reached')) {
    return { type: 'permanent', subtype: 'too_large', status };
  }
  if (err?.code === 'ETIMEDOUT' || message.includes('timeout')) {
    return { type: 'transient', subtype: 'timeout' };
  }
  
  return { type: 'permanent', subtype: 'unknown', status };
}

async function handleRetryOrFallback({ error, attempt, maxAttempts = 3, headers, onFallback }) {
  const classification = classifyError(error);
  const retryAfterHeader = headers?.get ? headers.get('retry-after') : headers?.['retry-after'];
  const parsedMs = parseRetryAfter(retryAfterHeader);

  const backoff = parsedMs !== null ? parsedMs : Math.min(1000 * Math.pow(2, attempt), 10000);

  if (classification.type === 'transient' && attempt < maxAttempts) {
    console.log(`[RetryStrategy] Transient error detected (${classification.subtype}). Fallback/Retry in ${backoff} ms.`);
    if (typeof onFallback === 'function') {
      onFallback({ error, classification, backoff, attempt });
    }
    await new Promise(resolve => setTimeout(resolve, backoff));
    return { shouldRetry: true, backoff };
  }

  return { shouldRetry: false, classification };
}

module.exports = {
  parseRetryAfter,
  classifyError,
  handleRetryOrFallback
};
