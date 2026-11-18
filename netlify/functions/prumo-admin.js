'use strict';

/**
 * Handler administrativo para Prumo com restrição de acesso.
 * Verifica se o usuário autenticado possui role 'master'.
 * Se não for master, responde 403.
 * Adicionado conforme solicitação de estrutura de controle.
 */

function createHandler(deps = {}) {
  const getDb = deps.getDb || (() => require('./firebase-init').db);
  const getMw = deps.getMw || (() => require('./middleware'));
  const now = deps.now || (() => Date.now());
  const buildHeaders = deps.makeHeaders || ((event) => getMw().makeHeaders(event));

  return async (event) => {
    const h = buildHeaders(event);
    if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: h, body: '' };
    if (!['GET', 'POST'].includes(event.httpMethod)) return { statusCode: 405, headers: h, body: JSON.stringify({ error: 'Method Not Allowed' }) };

    const mw = getMw();
    const auth = await mw.verifyBearerToken(event);
    if (!auth || !auth.ok) return { statusCode: 401, headers: h, body: JSON.stringify({ error: 'Entre com sua conta para acessar.' }) };
    if (auth.role !== 'master') return { statusCode: 403, headers: h, body: JSON.stringify({ error: 'Acesso negado: Requer role master' }) };

    // Acesso permitido: usuário é master.
    const db = getDb();
    let body = {};
    if (event.httpMethod === 'POST') {
      try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers: h, body: JSON.stringify({ error: 'JSON inválido' }) }; }
    }

    const parte = event.queryStringParameters?.parte || body.acao;

    if (parte === 'resumo') {
      const snap = await db.collection('prumo_users').get();
      const contagem = snap.size;
      const leiturasSnap = await db.collectionGroup('config').where('mes', '==', new Date(now()).toISOString().slice(0, 7)).get();
      const mensagensSnap = await db.collectionGroup('mensagens').where('status', '==', 'aberta').get();
      return { statusCode: 200, headers: h, body: JSON.stringify({ total_pessoas: contagem, leituras_mes: leiturasSnap.size, mensagens_abertas: mensagensSnap.size }) };
    }

    if (parte === 'plano_definir') {
      if (!body.uid || !body.plano) return { statusCode: 400, headers: h, body: JSON.stringify({ error: 'Faltam dados' }) };
      if (!['pro', 'free'].includes(body.plano)) return { statusCode: 400, headers: h, body: JSON.stringify({ error: 'Plano inválido' }) };
      const ref = db.collection('prumo_users').doc(body.uid);
      await ref.update({ plano: body.plano });
      await db.collection('auditoria').add({ acao: 'plano_definir', uid: body.uid, plano: body.plano, por: auth.uid, em: new Date(now()).toISOString() });
      return { statusCode: 200, headers: h, body: JSON.stringify({ ok: true }) };
    }

    if (parte === 'mensagem_responder') {
      if (!body.uid || !body.texto) return { statusCode: 400, headers: h, body: JSON.stringify({ error: 'Faltam dados' }) };
      const msgs = await db.collection('prumo_users').doc(body.uid).collection('mensagens').where('status', '==', 'aberta').get();
      const m = msgs.docs[0];
      if (!m) return { statusCode: 404, headers: h, body: JSON.stringify({ error: 'Nenhuma mensagem aberta' }) };
      await m.ref.update({ status: 'respondida', resposta: body.texto, respondido_em: new Date(now()).toISOString() });
      return { statusCode: 200, headers: h, body: JSON.stringify({ ok: true }) };
    }

    if (parte === 'mensagens') {
      const uid = event.queryStringParameters && event.queryStringParameters.uid;
      if (!uid) return { statusCode: 400, headers: h, body: JSON.stringify({ error: 'Faltam dados' }) };
      const msgs = await db.collection('prumo_users').doc(uid).collection('mensagens').get();
      return { statusCode: 200, headers: h, body: JSON.stringify({ mensagens: msgs.docs.map(d => d.data()) }) };
    }

    return { statusCode: 404, headers: h, body: JSON.stringify({ error: 'Ação não encontrada' }) };
  };
}

exports.handler = createHandler();
exports.createHandler = createHandler;
