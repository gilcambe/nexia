'use strict';
// Anexos entendidos de verdade (#825), só com cota grátis do Workers AI (REST, CLOUDFLARE_AI_TOKEN +
// CLOUDFLARE_AI_ACCOUNT_ID, as mesmas chaves que o roteador de modelos já usa):
//  - imagem  → texto da imagem e descrição em português (Llama 3.2 Vision, LLaVA de reserva);
//  - PDF, planilha (xlsx/xls/ods/csv), Word, HTML → texto (conversão "toMarkdown" do Workers AI);
//  - áudio   → transcrição (Whisper);
//  - texto/código → o próprio texto.
// Devolve { tipo, texto } com até MAX_TEXTO letras. Sem chave ou se a IA falhar, devolve { tipo, erro }.

const MAX_TEXTO = 8000;
const MAX_BYTES = 700 * 1024;
// #1639: Llama 3.2 Vision lê texto e números de foto e nota bem melhor que o LLaVA (que fica de reserva).
const MODELO_VISAO = '@cf/meta/llama-3.2-11b-vision-instruct';
const MODELO_VISAO_RESERVA = '@cf/llava-hf/llava-1.5-7b-hf';
const PEDIDO_VISAO = 'Transcreva primeiro, exatamente, todo o texto e todos os números visíveis na imagem (preços, totais, datas, formas de pagamento, nomes). Depois descreva a imagem em poucas linhas. Responda em português do Brasil.';
const MODELO_AUDIO = '@cf/openai/whisper-large-v3-turbo';

const EXT = {
  imagem: /\.(png|jpe?g|gif|webp|bmp)$/i,
  audio: /\.(mp3|m4a|wav|ogg|oga|opus|webm|aac|flac)$/i,
  documento: /\.(pdf|xlsx|xlsm|xls|ods|numbers|docx|odt|html?|xml|csv)$/i,
  texto: /\.(txt|md|js|ts|tsx|jsx|json|css|yml|yaml|log|sql|sh|py)$/i,
};

function tipoDe(nome = '', mime = '') {
  const m = String(mime).toLowerCase();
  if (m.startsWith('image/') || EXT.imagem.test(nome)) return 'imagem';
  if (m.startsWith('audio/') || EXT.audio.test(nome)) return 'audio';
  if (m === 'application/pdf' || /sheet|excel|spreadsheet|opendocument|wordprocessing|msword|text\/csv|text\/html|xml/.test(m) || EXT.documento.test(nome)) return 'documento';
  if (m.startsWith('text/') || m === 'application/json' || EXT.texto.test(nome)) return 'texto';
  return 'outro';
}

const cortar = (t) => { const s = String(t || '').trim(); return s.length > MAX_TEXTO ? s.slice(0, MAX_TEXTO) + '\n[… cortado]' : s; };

async function rodar(env, fetchImpl, modelo, corpo) {
  // Binding nativo do Workers AI (sem token), com fallback para REST.
  if (env && env.AI && typeof env.AI.run === 'function') {
    const r = await env.AI.run(modelo, corpo);
    return r || {};
  }
  // Binding nativo do Workers AI (sem token), com fallback para REST.
  if (env && env.AI && typeof env.AI.run === 'function') {
    const r = await env.AI.run(modelo, corpo);
    return r || {};
  }
  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.CLOUDFLARE_AI_ACCOUNT_ID)}/ai/run/${modelo}`;
  const r = await fetchImpl(url, { method: 'POST', headers: { Authorization: `Bearer ${env.CLOUDFLARE_AI_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.success === false) throw new Error(`Workers AI ${r.status}`);
  return j.result || {};
}

async function transcreverGroqWhisper(env, fetchImpl, buf, nome) {
  const apiKey = env && env.GROQ_API_KEY;
  if (!apiKey) return null;
  try {
    const form = new FormData();
    form.append('file', new Blob([buf], { type: 'audio/wav' }), nome || 'audio.wav');
    form.append('model', 'whisper-large-v3-turbo');
    form.append('language', 'pt');
    form.append('response_format', 'json');
    const url = 'https://api.groq.com/openai/v1/audio/transcriptions';
    const r = await fetchImpl(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!r.ok) return null;
    const j = await r.json().catch(() => ({}));
    return j.text || null;
  } catch {
    return null;
  }
}

async function paraMarkdown(env, fetchImpl, nome, mime, buf) {
  // Binding nativo do Workers AI (sem token), com fallback para REST.
  if (env && env.AI && typeof env.AI.toMarkdown === 'function') {
    const r = await env.AI.toMarkdown([{ name: nome, blob: new Blob([buf], { type: mime || 'application/octet-stream' }) }]);
    const item = Array.isArray(r) ? r[0] : r;
    if (!item || item.format === 'error') throw new Error('não consegui ler o documento');
    return item.data || '';
  }
  // Binding nativo do Workers AI (sem token), com fallback para REST.
  if (env && env.AI && typeof env.AI.toMarkdown === 'function') {
    const r = await env.AI.toMarkdown([{ name: nome, blob: new Blob([buf], { type: mime || 'application/octet-stream' }) }]);
    const item = Array.isArray(r) ? r[0] : r;
    if (!item || item.format === 'error') throw new Error('não consegui ler o documento');
    return item.data || '';
  }
  const form = new FormData();
  form.append('files', new Blob([buf], { type: mime || 'application/octet-stream' }), nome);
  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.CLOUDFLARE_AI_ACCOUNT_ID)}/ai/tomarkdown`;
  const r = await fetchImpl(url, { method: 'POST', headers: { Authorization: `Bearer ${env.CLOUDFLARE_AI_TOKEN}` }, body: form });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.success === false) throw new Error(`toMarkdown ${r.status}`);
  const item = Array.isArray(j.result) ? j.result[0] : j.result;
  if (!item || item.format === 'error') throw new Error('não consegui ler o documento');
  return item.data || '';
}

/** @param {{ nome: string, tipo?: string, base64: string }} anexo */
async function entenderAnexo(anexo, env = process.env, { fetchImpl = (...a) => fetch(...a) } = {}) {
  const nome = String(anexo.nome || 'arquivo').slice(0, 120);
  const mime = String(anexo.tipo || '');
  const tipo = tipoDe(nome, mime);
  const b64 = String(anexo.base64 || '');
  if (!/^[A-Za-z0-9+/=]+$/.test(b64) || b64.length < 4) return { tipo, erro: 'Arquivo inválido.' };
  const buf = Buffer.from(b64, 'base64');
  if (buf.length > MAX_BYTES) return { tipo, erro: 'Arquivo grande demais (até 700 KB).' };
  if (tipo === 'texto') return { tipo, texto: cortar(buf.toString('utf8')) };
  if (tipo === 'outro') return { tipo, erro: 'Tipo de arquivo que eu ainda não sei ler.' };
  if (!env.AI && (!env.CLOUDFLARE_AI_TOKEN || !env.CLOUDFLARE_AI_ACCOUNT_ID)) {
    if (tipo === 'audio' && env && env.GROQ_API_KEY) {
      const textoGroq = await transcreverGroqWhisper(env, fetchImpl, buf, nome);
      if (textoGroq) return { tipo, texto: cortar(textoGroq) };
    }
    return { tipo, erro: 'Falta ligar o Workers AI (CLOUDFLARE_AI_TOKEN).' };
  }
  try {
    if (tipo === 'imagem') {
      const corpo = { image: [...buf], max_tokens: 700, prompt: PEDIDO_VISAO };
      let r;
      try {
        r = await rodar(env, fetchImpl, MODELO_VISAO, corpo);
      } catch (e) {
        // O Llama 3.2 Vision pede um "agree" uma vez por conta (licença da Meta); depois tenta de novo e, se falhar, usa o LLaVA.
        if (/agree/i.test(String((e && e.message) || e))) { try { await rodar(env, fetchImpl, MODELO_VISAO, { prompt: 'agree' }); r = await rodar(env, fetchImpl, MODELO_VISAO, corpo); } catch { r = null; } }
        if (!r) r = await rodar(env, fetchImpl, MODELO_VISAO_RESERVA, corpo);
      }
      return { tipo, texto: cortar(r.description || r.response || '') };
    }
    if (tipo === 'audio') {
      let r;
      try {
        r = await rodar(env, fetchImpl, MODELO_AUDIO, { audio: b64, language: 'pt' });
      } catch (err) {
        const textoGroq = await transcreverGroqWhisper(env, fetchImpl, buf, nome);
        if (textoGroq) return { tipo, texto: cortar(textoGroq) };
        throw err;
      }
      return { tipo, texto: cortar(r.text || (r.transcription_info && r.transcription_info.text) || '') };
    }
    return { tipo, texto: cortar(await paraMarkdown(env, fetchImpl, nome, mime, buf)) };
  } catch (e) {
    return { tipo, erro: 'Não consegui entender o anexo agora (' + String((e && e.message) || e).slice(0, 80) + ').' };
  }
}

module.exports = { entenderAnexo, tipoDe, MAX_TEXTO, MAX_BYTES, MODELO_VISAO, MODELO_AUDIO };
