'use strict';

const siteKey = process.env.TURNSTILE_SITE_KEY || '1x00000000000000000000AA';
const secretKey = process.env.TURNSTILE_SECRET_KEY || '1x0000000000000000000000000000000AA';

/**
 * Valida o token Turnstile na API da Cloudflare.
 * @param {string} token - Token retornado pelo widget Turnstile.
 * @param {string} [remoteip] - IP opcional do cliente.
 * @returns {Promise<{success: boolean, 'error-codes'?: string[]}>}
 */
async function verifyTurnstileToken(token, remoteip) {
  if (!token) {
    return { success: false, 'error-codes': ['missing-input-response'] };
  }

  try {
    const params = new URLSearchParams({
      secret: secretKey,
      response: token,
    });
    if (remoteip) {
      params.append('remoteip', remoteip);
    }

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });

    const data = await response.json();
    return data;
  } catch (err) {
    return { success: false, 'error-codes': ['api-connection-error'], error: err.message };
  }
}

module.exports = {
  siteKey,
  secretKey,
  verifyTurnstileToken,
};
