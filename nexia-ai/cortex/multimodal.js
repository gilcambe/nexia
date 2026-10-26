'use strict';

const { entenderAnexo } = require('../../lib/anexos-entender');

const GEMINI_MODEL = 'gemini-2.5-flash';
const WORKERS_AI_FALLBACK = true;

/**
 * Envia mensagem e anexos para o Gemini 2.5 Flash de forma nativa e multimodal.
 * Cada anexo é enviado como inline_data. Se houver falha ou falta de cota,
 * faz fallback para o Workers AI consolidado (#1671, #1638, #1639).
 */
async function processarMultimodal(param1, param2, param3 = {}) {
  // Suporte a chamada posicional (env, fetchImpl, opts) ou via objeto único ({ env, fetchImpl, mensagem, anexos, ... })
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
  const message = opts.message ?? opts.mensagem;
  const attachments = Array.isArray(opts.attachments) ? opts.attachments : Array.isArray(opts.anexos) ? opts.anexos : [];
  const validAttachments = attachments.filter(a => a && a.base64);

  // Se houver chave do Gemini e arquivos/áudio/vídeo, tenta primeiro o Gemini 2.5 Flash nativo
  if (apiKey && validAttachments.length > 0) {
    try {
      const parts = [];
      
      // Adiciona cada anexo como inline_data
      for (const att of validAttachments) {
        const mime = att.tipo || 'application/octet-stream';
        parts.push({
          inline_data: {
            mime_type: mime,
            data: att.base64
          }
        });
      }

      // Adiciona prompt do usuário com instrução de tom de voz se houver áudio
      let promptText = message || 'Analise estes arquivos em conjunto e correlacione as informações.';
      if (validAttachments.some(a => (a.tipo || '').startsWith('audio/'))) {
        promptText += ' (Nota: observe também o tom de quem fala no áudio, se for relevante).';
      }
      
      parts.push({ text: promptText });

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }]
        })
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
      // Falhou no Gemini, prossegue para o fallback do Workers AI
    }
  }

  // Fallback: workers AI (#1671, #1638, #1639)
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

  const fallbackText = `(Resposta gerada via fallback Workers AI por anexo)\nMensagem do usuário: ${message}\n\n` + results.join('\n\n');
  return {
    ok: true,
    provedor: 'workers-ai',
    resposta: fallbackText
  };
}

module.exports = { processarMultimodal, GEMINI_MODEL };
