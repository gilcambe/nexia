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
import { VazaoController } from '../src/durable/VazaoController.js';
import cotas from '../lib/cotas.js';

// #1662: o Cloudflare só publica se a classe do Durable Object sair do arquivo de entrada.
export { VazaoController };

export async function audioChat(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
  if (!env || !env.AI) {
    return new Response(JSON.stringify({ error: 'Workers AI indisponível' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
  if (await cotas.freio(env, 'ia').catch(() => false)) {
    return new Response(JSON.stringify({ error: 'cota grátis do Workers AI perto do fim hoje; tente amanhã' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization') || '';
  if (!authHeader && env.REQUIRE_AUDIO_AUTH === '1') {
    return new Response(JSON.stringify({ error: 'Não autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  let audioData = null;
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const json = await request.json().catch(() => ({}));
    if (json.audio) {
      if (typeof json.audio === 'string') {
        const binary = atob(json.audio);
        audioData = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) audioData[i] = binary.charCodeAt(i);
      } else if (Array.isArray(json.audio)) {
        audioData = new Uint8Array(json.audio);
      }
    }
  } else {
    const ab = await request.arrayBuffer().catch(() => null);
    if (ab && ab.byteLength > 0) {
      audioData = new Uint8Array(ab);
    }
  }

  if (!audioData || audioData.length === 0) {
    return new Response(JSON.stringify({ error: 'Áudio não fornecido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const sendEvent = (event, data) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const whisperInput = { audio: Array.from(audioData) };
        let transcription = '';
        try {
          const resWhisper = await env.AI.run('@cf/openai/whisper-large-v3-turbo', whisperInput);
          transcription = (resWhisper && (resWhisper.text || (resWhisper.transcription_info && resWhisper.transcription_info.text))) || '';
        } catch (e) {
          console.error('[audio-chat] whisper erro:', e);
        }

        sendEvent('transcription', { type: 'transcription', text: transcription });

        if (!transcription.trim()) {
          sendEvent('done', { type: 'done', status: 'completed' });
          controller.close();
          return;
        }

        let responseText = '';
        try {
          const resLlama = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
            messages: [
              { role: 'system', content: 'Você é o assistente Cortex da NEXIA. Responda de forma direta e concisa em português.' },
              { role: 'user', content: transcription },
            ],
            max_tokens: 300,
          });
          responseText = (resLlama && (resLlama.response || resLlama.text)) || transcription;
        } catch (e) {
          responseText = transcription;
        }

        const sentences = responseText.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [responseText];

        const toBase64 = (arr) => {
          const u8 = arr instanceof Uint8Array ? arr : new Uint8Array(arr);
          let binary = '';
          for (let i = 0; i < u8.length; i++) binary += String.fromCharCode(u8[i]);
          return btoa(binary);
        };

        for (const sentence of sentences) {
          const trimmed = sentence.trim();
          if (!trimmed) continue;

          let audioChunkB64 = '';
          try {
            const resTts = await env.AI.run('@cf/myshell-ai/melotts', { text: trimmed, lang: 'pt' });
            if (resTts) {
              if (resTts.audio) {
                audioChunkB64 = typeof resTts.audio === 'string'
                  ? resTts.audio
                  : toBase64(resTts.audio);
              } else if (resTts instanceof ArrayBuffer || resTts instanceof Uint8Array) {
                audioChunkB64 = toBase64(resTts);
              }
            }
          } catch (e) {
            try {
              const resAura = await env.AI.run('@cf/deepgram/aura-1', { text: trimmed });
              if (resAura && resAura.audio) {
                audioChunkB64 = typeof resAura.audio === 'string'
                  ? resAura.audio
                  : toBase64(resAura.audio);
              }
            } catch (err2) {
              console.error('[audio-chat] tts fallback erro:', err2);
            }
          }

          sendEvent('audio', { type: 'audio', text: trimmed, audio: audioChunkB64 });
        }

        sendEvent('done', { type: 'done', status: 'completed' });
      } catch (err) {
        sendEvent('error', { type: 'error', message: String(err && err.message || err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
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
    if (pathname === '/api/corpo-ia') return corpoIa(request, env);
    if (pathname === '/v1/audio/chat') return audioChat(request, env);
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
