'use strict';

/**
 * Módulo de Multimodalidade Nativa do NEXIA AI (Pilar 1).
 * Junta múltiplos anexos (texto, imagem, áudio, vídeo, PDF/planilhas) numa única chamada
 * ao Gemini 2.5 Flash via `GEMINI_API_KEY`, com cada arquivo como `inline_data`.
 * Em caso de falha ou sem cota, faz fallback para o caminho do Workers AI (`anexos-entender.js`).
 */

const { entenderAnexo } = require('../../lib/anexos-entender');

const MAX_TOTAL_BYTES = 20 * 1024 * 1024; // 20 MB no total
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/';

/**
 * Mapeia mime types aceitos pelo Gemini inline_data.
 */
function normalizeMime(tipo, nome) {
  const t = String(tipo || '').toLowerCase();
  if (t && t.includes('/')) return t;
  const n = String(nome || '').toLowerCase();
  if (n.endsWith('.png')) return 'image/png';
  if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg';
  if (n.endsWith('.webp')) return 'image/webp';
  if (n.endsWith('.pdf')) return 'application/pdf';
  if (n.endsWith('.mp3')) return 'audio/mp3';
  if (n.endsWith('.wav')) return 'audio/wav';
  if (n.endsWith('.m4a')) return 'audio/mp4';
  if (n.endsWith('.ogg')) return 'audio/ogg';
  if (n.endsWith('.mp4')) return 'video/mp4';
  if (n.endsWith('.csv')) return 'text/csv';
  if (n.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  return 'application/octet-stream';
}

/**
 * Tenta enviar tudo numa única chamada ao Gemini 2.5 Flash.
 * @param {object} env
 * @param {Function} fetchImpl
 * @param {string} prompt
 * @param {Array<{ nome: string, tipo?: string, base64: string }>} anexos
 */
async function processarMultimodalGemini(env, fetchImpl, prompt, anexos) {
  const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY ausente');

  let totalBytes = 0;
  const parts = [];

  for (const anexo of anexos) {
    const b64 = String(anexo.base64 || '');
    if (!b64) continue;
    const buf = Buffer.from(b64, 'base64');
    totalBytes += buf.length;
    if (totalBytes > MAX_TOTAL_BYTES) {
      throw new Error('Tamanho total dos anexos excede o limite de 20 MB do Gemini.');
    }

    const mimeType = normalizeMime(anexo.tipo, anexo.nome);
    parts.push({
      inline_data: {
        mime_type: mimeType,
        data: b64
      }
    });
  }

  // Adiciona instrução de tom de voz se houver áudio e prompt reforçado
  const textPrompt = `Você é o NEXIA AI, especialista em análise multimodal nativa.
Analise todos os arquivos anexados em conjunto e o texto do usuário.
Se houver arquivos de áudio, note também o tom de voz de quem fala, se for relevante.
Na sua resposta, cite explicitamente de qual anexo veio cada informação (ex: "no áudio...", "na planilha, linha X...", "na imagem...").
Usuário: ${prompt || 'Analise estes anexos.'}`;

  parts.push({ text: textPrompt });

  const url = `${GEMINI_API_URL}${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }]
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    const errMessage = data.error?.message || `Gemini status ${response.status}`;
    throw new Error(errMessage);
  }

  const candidate = data.candidates?.[0];
  const responseText = candidate?.content?.parts?.[0]?.text;
  if (!responseText) {
    throw new Error('Resposta vazia do Gemini multimodal.');
  }

  return {
    provedor: 'gemini-2.5-flash',
    texto: responseText
  };
}

/**
 * Caminho de Fallback (Workers AI) quando o Gemini falha ou está sem cota.
 * Processa cada anexo individualmente com Workers AI e junta as respostas.
 */
async function processarMultimodalFallback(env, fetchImpl, prompt, anexos) {
  const resultados = [];
  for (let i = 0; i < anexos.length; i++) {
    const anexo = anexos[i];
    const nome = anexo.nome || `anexo_${i + 1}`;
    const res = await entenderAnexo(anexo, env, { fetchImpl });
    if (res.erro) {
      resultados.push(`[Anexo ${i + 1} (${nome}): erro - ${res.erro}]`);
    } else {
      resultados.push(`[Informações extraídas do anexo ${i + 1} (${nome}), tipo ${res.tipo}]:\n${res.texto}`);
    }
  }

  return {
    provedor: 'workers-ai-fallback',
    texto: `[Fallback Workers AI ativado]\nPrompt do usuário: ${prompt}\n\nResultados dos anexos:\n${resultados.join('\n\n')}`
  };
}

/**
 * Função principal que decide se usa o Gemini 2.5 Flash (quando há 2+ anexos ou áudio/vídeo)
 * com fallback automático para Workers AI.
 * 
 * @param {object} env
 * @param {Function} fetchImpl
 * @param {string} prompt
 * @param {Array<{ nome: string, tipo?: string, base64: string }>} anexos
 */
async function processarMultimodal(env, fetchImpl = (...args) => fetch(...args), prompt = '', anexos = []) {
  if (!Array.isArray(anexos) || anexos.length === 0) {
    return { provedor: 'nenhum', texto: null };
  }

  let totalBytes = 0;
  let temAudioOuVideo = false;
  for (const a of anexos) {
    const b64 = String(a.base64 || '');
    const buf = Buffer.from(b64, 'base64');
    totalBytes += buf.length;
    const mime = String(a.tipo || '').toLowerCase();
    const nome = String(a.nome || '').toLowerCase();
    if (mime.startsWith('audio/') || mime.startsWith('video/') || /\.(mp3|m4a|wav|ogg|oga|opus|webm|aac|flac|mp4|mov|avi)$/i.test(nome)) {
      temAudioOuVideo = true;
    }
  }

  if (totalBytes > MAX_TOTAL_BYTES) {
    throw new Error('Tamanho total dos anexos ultrapassa o limite de 20 MB.');
  }

  // Se tem 2+ anexos ou áudio/vídeo, tenta Gemini primeiro
  const deveUsarGemini = anexos.length >= 2 || temAudioOuVideo;

  if (deveUsarGemini) {
    try {
      return await processarMultimodalGemini(env, fetchImpl, prompt, anexos);
    } catch (err) {
      console.warn('Gemini multimodal falhou, caindo para Workers AI fallback:', err.message);
    }
  }

  // Caso contrário ou se o Gemini falhou, roda fallback do Workers AI
  return await processarMultimodalFallback(env, fetchImpl, prompt, anexos);
}

module.exports = {
  processarMultimodal,
  processarMultimodalGemini,
  processarMultimodalFallback,
  MAX_TOTAL_BYTES,
  GEMINI_MODEL
};
