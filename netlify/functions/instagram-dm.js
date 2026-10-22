'use strict';

// KERNEX Nutri — Webhook para Resposta Automática no Instagram DM por Palavra-Chave (Adriano Blumer)
// Integração com Meta Graph API ("Private Reply" a comentários no Instagram)
//
// GET  /api/instagram-dm → Verificação de Webhook da Meta (hub.mode, hub.verify_token, hub.challenge)
// POST /api/instagram-dm → Eventos de comentários no Instagram com validação X-Hub-Signature-256

const crypto = require('crypto');

const SLUG = 'adriano';
const COLLECTION_NUTRI = 'nutri_contas';
const TEMPO_LIMITE_USUARIO_MS = 24 * 60 * 60 * 1000; // 24 horas

// ── Funções Auxiliares de Texto e Comparação ─────────────────────────────

function normalizarTexto(txt) {
  if (typeof txt !== 'string') return '';
  return txt
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function tempoConstanteIguais(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function validarAssinatura(corpoBruto, signature, secret) {
  if (!signature || !secret) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(corpoBruto || '').digest('hex');
  return tempoConstanteIguais(signature, expected);
}

function testarPalavraChave(textoComentarioNorm, palavrasRegra) {
  if (!textoComentarioNorm || !Array.isArray(palavrasRegra)) return false;
  return palavrasRegra.some(p => {
    const pNorm = normalizarTexto(p);
    if (!pNorm) return false;
    // Palavra ou frase inteira (não casa no meio de outra palavra: "oi" não casa em "boi")
    const regex = new RegExp(`(?:^|\\W)${pNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|\\W)`, 'i');
    return regex.test(textoComentarioNorm);
  });
}

// ── Handler Principal ───────────────────────────────────────────────────────

function createHandler(deps = {}) {
  const getDb = deps.getDb || (() => require('./firebase-init').db);
  const fetchApi = deps.fetchApi || (async (url, opts) => fetch(url, opts));
  const getEnv = deps.getEnv || (key => process.env[key]);
  const now = deps.now || (() => Date.now());

  return async (event) => {
    const method = String(event.httpMethod || '').toUpperCase();
    const headers = event.headers || {};
    const cors = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Hub-Signature-256',
    };

    if (method === 'OPTIONS') return { statusCode: 204, headers, body: '' };

    const appSecret = getEnv('META_APP_SECRET');
    const verifyToken = getEnv('IG_VERIFY_TOKEN');
    const pageToken = getEnv('IG_PAGE_TOKEN');
    const igUserId = getEnv('IG_USER_ID');

    // ── GET: Verificação do Webhook pela Meta ──────────────────────────────
    if (method === 'GET') {
      const q = event.queryStringParameters || {};
      const mode = q['hub.mode'];
      const token = q['hub.verify_token'];
      const challenge = q['hub.challenge'];

      if (mode === 'subscribe' && token && verifyToken && tempoConstanteIguais(token, verifyToken)) {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'text/plain' },
          body: challenge || '',
        };
      }
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Verificação falhou. Token ou modo incorreto.' }) };
    }

    if (method !== 'POST') {
      return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    // ── POST: Processamento de Webhook da Meta ─────────────────────────────
    const signature = headers['x-hub-signature-256'] || headers['X-Hub-Signature-256'];
    if (!appSecret || !validarAssinatura(event.body || '', signature, appSecret)) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Assinatura X-Hub-Signature-256 inválida ou ausente.' }) };
    }

    // Retorno rápido HTTP 200 padrão para a Meta
    const resOk = (detalhes = {}) => ({
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, ...detalhes }),
    });

    // Se faltarem variáveis essenciais para envio de mensagens, apenas registra log seguro e encerra
    if (!pageToken || !igUserId) {
      console.warn('[Instagram DM] Falta configurar variáveis de ambiente (IG_PAGE_TOKEN ou IG_USER_ID).');
      return resOk({ aviso: 'falta configurar' });
    }

    const db = getDb();
    if (!db) {
      console.error('[Instagram DM] Firestore indisponível.');
      return resOk({ aviso: 'banco indisponível' });
    }

    let payload = {};
    try {
      payload = JSON.parse(event.body || '{}');
    } catch {
      return resOk({ aviso: 'corpo json invalido' });
    }

    const entries = Array.isArray(payload.entry) ? payload.entry : [];
    if (entries.length === 0) return resOk({ recebidos: 0 });

    // Ler regras ativas salvas no Firestore para a conta do nutricionista
    const contaRef = db.collection(COLLECTION_NUTRI).doc(SLUG);
    const configSnap = await contaRef.collection('dm_config').doc('regras').get();

    if (!configSnap.exists) {
      return resOk({ aviso: 'sem regras configuradas' });
    }

    const configData = configSnap.data() || {};
    const regrasAtivas = (Array.isArray(configData.regras) ? configData.regras : [])
      .filter(r => r && r.ativa && Array.isArray(r.palavras) && r.palavras.length > 0 && r.mensagem);

    if (regrasAtivas.length === 0) {
      return resOk({ aviso: 'sem regras ativas' });
    }

    let recebidos = 0;
    let enviados = 0;
    let ignorados = 0;
    let erros = 0;

    const agora = now();

    for (const entry of entries) {
      const changes = Array.isArray(entry.changes) ? entry.changes : [];
      for (const change of changes) {
        if (change.field !== 'comments' || !change.value) continue;
        recebidos++;

        const comment = change.value;
        const commentId = String(comment.id || '').trim();
        const commentText = String(comment.text || '').trim();
        const fromUser = comment.from || {};
        const fromUserId = String(fromUser.id || '').trim();

        if (!commentId || !commentText || !fromUserId) {
          ignorados++;
          continue;
        }

        // Ignorar comentários da própria conta do Instagram
        if (fromUserId === igUserId) {
          ignorados++;
          continue;
        }

        const commentTextNorm = normalizarTexto(commentText);

        // Encontrar primeira regra que bate com o texto do comentário
        const regraEncontrada = regrasAtivas.find(r => testarPalavraChave(commentTextNorm, r.palavras));
        if (!regraEncontrada) {
          ignorados++;
          continue;
        }

        // Verificar se este comentário já foi respondido
        const enviadoRef = contaRef.collection('dm_enviados').doc(commentId);
        const enviadoSnap = await enviadoRef.get();
        if (enviadoSnap.exists) {
          ignorados++;
          continue;
        }

        // Verificar limite por usuário (1 DM a cada 24 h)
        const usuarioRef = contaRef.collection('dm_usuarios').doc(fromUserId);
        const usuarioSnap = await usuarioRef.get();
        if (usuarioSnap.exists) {
          const ultimoEnvio = Number(usuarioSnap.data().ultimo_envio) || 0;
          if (agora - ultimoEnvio < TEMPO_LIMITE_USUARIO_MS) {
            ignorados++;
            continue;
          }
        }

        // Reserva o comentário ANTES de enviar: se a Meta reenviar o mesmo evento ao mesmo tempo,
        // só um processamento passa (create falha se o documento já existe).
        try {
          await enviadoRef.create({ comment_id: commentId, user_id: fromUserId, estado: 'enviando', reservado_em: new Date(agora).toISOString() });
        } catch {
          ignorados++;
          continue;
        }

        // Montar mensagem privada
        let textoMensagem = regraEncontrada.mensagem;
        if (regraEncontrada.link) {
          textoMensagem += '\n' + regraEncontrada.link;
        }

        const bodyGraph = {
          recipient: { comment_id: commentId },
          message: { text: textoMensagem },
        };

        try {
          const versao = String(getEnv('IG_GRAPH_VERSION') || 'v23.0').replace(/[^v0-9.]/g, '').slice(0, 10) || 'v23.0';
          const graphUrl = `https://graph.facebook.com/${versao}/${igUserId}/messages`;
          const graphRes = await fetchApi(graphUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${pageToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(bodyGraph),
          });

          if (!graphRes.ok) {
            await enviadoRef.delete().catch(() => {}); // libera para nova tentativa
            erros++;
            console.error(`[Instagram DM] Erro no envio da Graph API: ${graphRes.status}`);
            continue;
          }

          // Registrar envio no Firestore para desduplicação e limite de taxa
          const dataIso = new Date(agora).toISOString();
          await enviadoRef.set({
            comment_id: commentId,
            user_id: fromUserId,
            regra_id: regraEncontrada.id || 'regra',
            enviado_em: dataIso,
          });

          await usuarioRef.set({
            user_id: fromUserId,
            ultimo_envio: agora,
            ultimo_envio_em: dataIso,
          }, { merge: true });

          enviados++;
        } catch (e) {
          await enviadoRef.delete().catch(() => {});
          erros++;
          console.error('[Instagram DM] Exceção ao chamar Graph API:', e && e.message ? e.message : 'Erro desconhecido');
        }
      }
    }

    // Registrar estatísticas genéricas (sem dados pessoais além dos contadores)
    try {
      const statsRef = contaRef.collection('dm_stats').doc('resumo');
      const statsSnap = await statsRef.get();
      const st = statsSnap.exists ? statsSnap.data() : {};
      await statsRef.set({
        total_recebidos: (Number(st.total_recebidos) || 0) + recebidos,
        total_enviados: (Number(st.total_enviados) || 0) + enviados,
        total_ignorados: (Number(st.total_ignorados) || 0) + ignorados,
        total_erros: (Number(st.total_erros) || 0) + erros,
        ultimo_evento_em: new Date(agora).toISOString(),
      }, { merge: true });
    } catch {
      // Ignora erro em stats para não afetar webhook
    }

    return resOk({ recebidos, enviados, ignorados, erros });
  };
}

exports.handler = createHandler();
exports.createHandler = createHandler;
exports.normalizarTexto = normalizarTexto;
exports.validarAssinatura = validarAssinatura;
exports.testarPalavraChave = testarPalavraChave;
