'use strict';

// Cortex TTS: sintese de voz com Workers AI (@cf/myshell-ai/melotts), com fallback gracioso no frontend.
function createHandler(deps = {}) {
  const getMw = deps.getMw || (() => require('./middleware'));

  return async (event) => {
    const method = String(event.httpMethod || '').toUpperCase();
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (method === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
    if (method !== 'POST') return { statusCode: 405, headers: cors, body: JSON.stringify({ error: 'Method Not Allowed' }) };

    const auth = await getMw().verifyBearerToken(event).catch(() => ({ ok: false }));
    if (!auth.ok || auth.role !== 'master') {
      return { statusCode: 403, headers: cors, body: JSON.stringify({ error: 'Só o dono da NEXIA usa a síntese de voz.' }) };
    }

    let body = {};
    try { body = JSON.parse(event.body || '{}') || {}; } catch {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'JSON inválido.' }) };
    }

    const texto = String(body.texto || body.text || '').trim().slice(0, 1000);
    if (!texto) {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Texto para síntese de voz é obrigatório.' }) };
    }

    const env = deps.env || (globalThis.__NEXIA_AI__ ? { ...process.env, AI: globalThis.__NEXIA_AI__ } : process.env);
    const fetchImpl = deps.fetchImpl || fetch;

    try {
      let audioBuffer;

      // Binding nativo do Workers AI
      if (env && env.AI && typeof env.AI.run === 'function') {
        const res = await env.AI.run('@cf/myshell-ai/melotts', { text: texto, lang: 'pt' });
        if (res instanceof ArrayBuffer || res instanceof Uint8Array || Buffer.isBuffer(res)) {
          audioBuffer = Buffer.from(res);
        } else if (res && res.audio) {
          audioBuffer = Buffer.from(res.audio, typeof res.audio === 'string' ? 'base64' : undefined);
        }
      }

      // Fallback REST para Cloudflare Workers AI
      if (!audioBuffer && env.CLOUDFLARE_AI_ACCOUNT_ID && env.CLOUDFLARE_AI_TOKEN) {
        const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.CLOUDFLARE_AI_ACCOUNT_ID)}/ai/run/@cf/myshell-ai/melotts`;
        const r = await fetchImpl(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.CLOUDFLARE_AI_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: texto, lang: 'pt' }),
        });

        if (r.ok) {
          const ab = await r.arrayBuffer();
          audioBuffer = Buffer.from(ab);
        }
      }

      if (!audioBuffer || audioBuffer.length === 0) {
        return { statusCode: 502, headers: cors, body: JSON.stringify({ error: 'Não foi possível gerar o áudio no Workers AI.' }) };
      }

      return {
        statusCode: 200,
        headers: {
          ...cors,
          'Content-Type': 'audio/wav',
          'Cache-Control': 'no-store',
        },
        body: audioBuffer.toString('base64'),
        isBase64Encoded: true,
      };
    } catch (e) {
      return { statusCode: 500, headers: cors, body: JSON.stringify({ error: String((e && e.message) || e) }) };
    }
  };
}

exports.createHandler = createHandler;
exports.handler = createHandler();
