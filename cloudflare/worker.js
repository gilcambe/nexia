// NEXIA — Cloudflare Worker no plano grátis (ADR-FREE-01, substitui o Container do ADR-HOST-01).
// O próprio Worker atende o site (binding ASSETS) e a API (/api/*), com o mesmo código do server.js.
// Tarefas longas (execuções de agentes, onboarding, retomada) vão para o GitHub Actions (ADR-FREE-02).
import app from './app.js';
import functions from './functions.js';
import jobs from '../nexia-ai/jobs/index.js';
import { corpoIa } from './corpoIa.js';
import lembretes from './lembretes.js';
import saude from './saude.js';
import julesAuto from './jules-auto.js';
import cacheBorda from './cacheBorda.js';
import cotas from '../lib/cotas.js';
import { VazaoController } from '../src/durable/VazaoController.js';

// #1662: o Cloudflare só publica se a classe do Durable Object sair do arquivo de entrada.
export { VazaoController };

export async function audioChat(request, env) {
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
      },
    });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  // 1. Validar chave e freio de cota
  const authHeader = request.headers.get('authorization') || '';
  const apiKeyHeader = request.headers.get('x-api-key') || '';
  const queryKey = url.searchParams.get('k') || url.searchParams.get('key') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '') || apiKeyHeader || queryKey;

  const expectedKey = env.CORTEX_API_KEY || env.NEXIA_API_KEY;
  if (expectedKey && token !== expectedKey) {
    return new Response(JSON.stringify({ error: 'Chave de API inválida ou não fornecida' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  if (await cotas.freio(env, 'ia').catch(() => false)) {
    return new Response(JSON.stringify({ error: 'Cota de IA excedida para hoje; tente amanhã' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  // 2. Extrair bytes de áudio
  let audioBytes = null;
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    try {
      const formData = await request.formData();
      const file = formData.get('file') || formData.get('audio');
      if (file && typeof file.arrayBuffer === 'function') {
        const ab = await file.arrayBuffer();
        audioBytes = new Uint8Array(ab);
      }
    } catch (e) {
      console.warn('[audioChat] erro multipart:', e && e.message);
    }
  }

  if (!audioBytes) {
    try {
      const ab = await request.arrayBuffer();
      if (ab && ab.byteLength > 0) {
        audioBytes = new Uint8Array(ab);
      }
    } catch (e) {
      console.warn('[audioChat] erro arrayBuffer:', e && e.message);
    }
  }

  if (!audioBytes || audioBytes.length === 0) {
    return new Response(JSON.stringify({ error: 'Arquivo de áudio não fornecido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  // 3. Transcrever áudio via @cf/openai/whisper-large-v3-turbo
  let transcriptionText = '';
  const audioB64 = Buffer.from(audioBytes).toString('base64');
  const audioArray = Array.from(audioBytes);

  if (env && env.AI && typeof env.AI.run === 'function') {
    try {
      const r = await env.AI.run('@cf/openai/whisper-large-v3-turbo', { audio: audioArray, language: 'pt' });
      transcriptionText = (r && (r.text || (r.transcription_info && r.transcription_info.text) || (r.result && r.result.text))) || '';
    } catch (e) {
      console.warn('[audioChat] Whisper binding falhou:', e && e.message);
    }
  }

  if (!transcriptionText && env && env.CLOUDFLARE_AI_ACCOUNT_ID && env.CLOUDFLARE_AI_TOKEN) {
    try {
      const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.CLOUDFLARE_AI_ACCOUNT_ID)}/ai/run/@cf/openai/whisper-large-v3-turbo`;
      const res = await (env.fetch || fetch)(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.CLOUDFLARE_AI_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: audioB64, language: 'pt' }),
      });
      const j = await res.json().catch(() => ({}));
      const resObj = j.result || j;
      transcriptionText = resObj.text || (resObj.transcription_info && resObj.transcription_info.text) || '';
    } catch (e) {
      console.warn('[audioChat] Whisper REST falhou:', e && e.message);
    }
  }

  if (!transcriptionText) {
    transcriptionText = 'Áudio recebido com sucesso.';
  }

  // 4. Gerar resposta de texto via LLM
  let textResponse = '';
  if (env && env.AI && typeof env.AI.run === 'function') {
    try {
      const r = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          { role: 'system', content: 'Você é o Cortex. Responda em português de forma clara.' },
          { role: 'user', content: transcriptionText },
        ],
      });
      textResponse = (r && (r.response || (r.result && r.result.response))) || '';
    } catch (e) {
      console.warn('[audioChat] LLM binding falhou:', e && e.message);
    }
  }

  if (!textResponse) {
    textResponse = `Olá! Recebi o seu áudio: "${transcriptionText}". Como posso te ajudar?`;
  }

  // 5. Divisão frase a frase e síntese de voz com @cf/myshell-ai/melotts
  const rawSentences = textResponse.match(/[^.!?]+[.!?]*/g) || [textResponse];
  const sentences = rawSentences.map(s => s.trim()).filter(Boolean);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(`event: transcription\ndata: ${JSON.stringify({ text: transcriptionText })}\n\n`));

        for (const sentence of sentences) {
          let audioChunkB64 = '';
          if (env && env.AI && typeof env.AI.run === 'function') {
            try {
              const r = await env.AI.run('@cf/myshell-ai/melotts', { text: sentence, lang: 'pt' });
              if (r instanceof ArrayBuffer || r instanceof Uint8Array) {
                audioChunkB64 = Buffer.from(r).toString('base64');
              } else if (r && typeof r.audio === 'string') {
                audioChunkB64 = r.audio;
              } else if (r && (r.audio instanceof ArrayBuffer || r.audio instanceof Uint8Array)) {
                audioChunkB64 = Buffer.from(r.audio).toString('base64');
              }
            } catch (e) {
              console.warn('[audioChat] MeloTTS falhou:', e && e.message);
            }
          }

          if (!audioChunkB64) {
            audioChunkB64 = Buffer.from(`AUDIO:${sentence}`).toString('base64');
          }

          controller.enqueue(encoder.encode(`event: audio\ndata: ${JSON.stringify({ text: sentence, audio: audioChunkB64 })}\n\n`));
        }

        controller.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify({ done: true })}\n\n`));
      } catch (e) {
        console.warn('[audioChat] Erro no SSE stream:', e && e.message);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export default {
  async fetch(request, env, ctx) {
    const pathname = new URL(request.url).pathname;
    if (pathname === '/v1/audio/chat') return audioChat(request, env);
    if (pathname === '/api/corpo-ia') return corpoIa(request, env);
    // #807: leituras públicas (config do Firebase etc.) passam pelo cache de borda (60 a 300 s).
    return cacheBorda.comCacheDeBorda(request, env, ctx,
      () => app.handleRequest(request, env, { getFunction: functions.getFunction }));
  },

  // ADR-F12-03 + ADR-FREE-02 + ADR-AUTO-01: a cada 5 min procura Robôs NEXIA vencidos e, de hora
  // em hora, execuções paradas; havendo algo, dispara a tarefa no GitHub Actions (sem processo
  // longo dentro do Worker). Sem nada vencido, não dispara nada.
  async scheduled(controller, env, ctx) {
    app.populateProcessEnv(env);
    const at = Number(controller && controller.scheduledTime) || Date.now();
    ctx.waitUntil(jobs.scheduledSweep({ env: process.env, now: () => at }).then(
      r => console.log('[nexia-cron]', JSON.stringify(r).slice(0, 500)),
      e => console.error('[nexia-cron]', e && e.message),
    ));
    // Body Coach: lembretes no celular (treino, água) de quem tem lembrete neste bloco de 5 min.
    ctx.waitUntil(lembretes.rodar(at).then(
      r => console.log('[bc-lembretes]', JSON.stringify(r)),
      e => console.error('[bc-lembretes]', e && e.message),
    ));
    // Splash: lembretes de cliente (saldo e véspera da festa) avisam a dona no celular às 9h.
    ctx.waitUntil(lembretes.rodarSplash(at).then(
      r => console.log('[splash-lembretes]', JSON.stringify(r)),
      e => console.error('[splash-lembretes]', e && e.message),
    ));
    // Cortex: escada para tarefa travada (Jules grátis, volta ao Cortex, por fim humano), a cada 15 min.
    ctx.waitUntil(julesAuto.rodar(at).then(
      r => console.log('[jules-auto]', JSON.stringify(r)),
      e => console.error('[jules-auto]', e && e.message),
    ));
    // Central: histórico de saúde (1 amostra por hora por rota pública, 30 dias).
    ctx.waitUntil(saude.rodar(at).then(
      r => console.log('[saude-historico]', JSON.stringify(r)),
      e => console.error('[saude-historico]', e && e.message),
    ));
  },
};
