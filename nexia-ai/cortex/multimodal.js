'use strict';

const { entenderAnexo } = require('../../lib/anexos-entender');

const GEMINI_MODEL = 'gemini-2.5-flash';
const MAX_TOTAL_BYTES = 20 * 1024 * 1024; // 20 MB limite total para inline_data

const BASE64_RE = /^[A-Za-z0-9+/=]+$/;
function base64Valida(b64) {
  return typeof b64 === 'string' && BASE64_RE.test(b64) && b64.length % 4 === 0 && b64.length >= 4;
}
function sanitizarTexto(t) {
  return String(t || '').replace(/[`*_\\[\]#()<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
}

/**
 * Envia mensagem e anexos para o Gemini 2.5 Flash de forma nativa e multimodal.
 * Cita explicitamente de qual anexo veio cada informação.
 */
async function processarMultimodal(param1, param2, param3 = {}) {
  let env, fetchImpl, opts;
  if (param1 && typeof param1 === 'object' && (param1.env || param1.fetchImpl || param1.mensagem || param1.anexos || param1.message || param1.attachments)) {
    env = param1.env || {};
    fetchImpl = param1.fetchImpl || global.fetch;
    opts = param1;
  } else {
    env = param1 || {};
    fetchImpl = param2 || global.fetch;
    opts = param3 || {};
  }
  const apiKey = env.GEMINI_API_KEY;
  const message = (opts.message ?? opts.mensagem) || '';
  const attachments = Array.isArray(opts.attachments) ? opts.attachments : Array.isArray(opts.anexos) ? opts.anexos : [];
  const validAttachments = attachments.filter(a => a && a.base64);

  // Validação de limites
  let totalBytes = 0;
  for (const att of validAttachments) {
    if (att.base64) {
      totalBytes += Buffer.from(att.base64, 'base64').length;
    }
  }
  if (totalBytes > MAX_TOTAL_BYTES) {
    return {
      ok: false,
      error: `Os anexos excedem o limite de 20 MB (total atual: ${(totalBytes / (1024 * 1024)).toFixed(1)} MB).`
    };
  }

  // Tenta Gemini 2.5 Flash nativo
  if (apiKey && validAttachments.length > 0) {
    try {
      const parts = [];
      validAttachments.forEach((att, index) => {
        const mime = att.tipo || 'application/octet-stream';
        parts.push({
          inline_data: {
            mime_type: mime,
            data: att.base64
          }
        });
        parts.push({ text: `[Identificação do Anexo ${index + 1}: ${att.nome || 'arquivo'} (tipo: ${mime})]` });
        // vídeo (video/*) é aceito por inline_data e listado junto aos demais tipos suportados
      });

      let promptText = message || 'Analise estes arquivos em conjunto e correlacione as informações.';
      promptText += ' Nota sobre o tom de voz: note o tom de voz de quem fala (áudio ou vídeo) e o tom de cada texto (imagem, documento, vídeo), se for relevante.';
      promptText += ' Na sua resposta, cite explicitamente de qual anexo veio cada informação (ex: "no áudio...", "na planilha...", "na foto...", "no vídeo...", "no texto...").';

      parts.push({ text: promptText });

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }] })
      });

      if (res.ok) {
        const data = await res.json();
        const candidate = data.candidates && data.candidates[0];
        if (candidate && candidate.content && candidate.content.parts) {
          const textParts = candidate.content.parts.map(p => p.text || '').join('\n');
          if (textParts.trim()) {
            return {
              ok: true,
              provedor: 'gemini',
              resposta: textParts
            };
          }
        }
      }
    } catch (err) {
      // Cai no fallback se Gemini falhar
    }
  }

  // Fallback para Workers AI (#1671, #1638, #1639)
  const results = [];
  for (let i = 0; i < validAttachments.length; i++) {
    const att = validAttachments[i];
    const resp = await entenderAnexo(att, env, { fetchImpl });
    const nomeAnexo = att.nome || `anexo ${i + 1}`;
    if (resp.erro) {
      results.push(`[Anexo ${i + 1} (${nomeAnexo}): erro - ${resp.erro}]`);
    } else {
      results.push(`[Informação extraída do anexo ${i + 1} (${nomeAnexo})]:\n${resp.texto}`);
    }
  }

  const fallbackText = `(Resposta gerada via fallback Workers AI por anexo)\nMensagem: ${message}\n\n` + results.join('\n\n');
  return {
    ok: true,
    provedor: 'workers-ai',
    resposta: fallbackText
  };
}

module.exports = { processarMultimodal, GEMINI_MODEL, MAX_TOTAL_BYTES };
