'use strict';

// Viajante Pro — Chat viajante-agência e SOS com GPS
// Firestore:
//   viagens/<viagem_id> { cliente_nome, destino, status, ... }
//   viagens/<viagem_id>/mensagens/<msg_id> { viagem_id, de: 'cliente'|'equipe', nome_equipe, texto, id_local, criado_em, lida }

const COLLECTION_VIAGENS = 'viagens';

const str = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '');

function createHandler(deps = {}) {
  const getDb = deps.getDb || (() => require('./firebase-init').db);
  const getMw = deps.getMw || (() => require('./middleware'));
  const nowFn = deps.now || (() => Date.now());

  return async (event) => {
    const method = String(event.httpMethod || '').toUpperCase();
    const headers = event.headers || {};
    const cors = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    const res = (statusCode, body) => ({ statusCode, headers: cors, body: JSON.stringify(body) });

    if (method === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
    if (method !== 'GET' && method !== 'POST') return res(405, { error: 'Method Not Allowed' });

    let body = {};
    if (method === 'POST' && event.body) {
      try { body = JSON.parse(event.body); } catch { return res(400, { error: 'Pedido inválido.' }); }
    }
    const q = event.queryStringParameters || {};

    const db = getDb();
    if (!db) return res(503, { error: 'Serviço indisponível. Tente de novo em instantes.' });

    const acao = str(method === 'GET' ? q.acao : body.acao, 30);

    // ── 1. msg_enviar (Público/Passageiro ou Equipe) ─────────────────
    if (acao === 'msg_enviar') {
      const viagem_id = str(method === 'GET' ? q.viagem_id : body.viagem_id, 80);
      if (!viagem_id) return res(400, { error: 'Informe o ID da viagem.' });

      const texto = str(body.texto, 2000);
      if (!texto) return res(400, { error: 'Texto da mensagem não pode ser vazio.' });

      const id_local = str(body.id_local, 100);
      const de = str(body.de, 20) === 'equipe' ? 'equipe' : 'cliente';
      const nome_equipe = str(body.nome_equipe, 80) || (de === 'equipe' ? 'Agência' : '');

      const msgsRef = db.collection(COLLECTION_VIAGENS).doc(viagem_id).collection('mensagens');

      // Idempotência por id_local para evitar duplicados no reenvio offline
      if (id_local) {
        const exist = await msgsRef.where('id_local', '==', id_local).limit(1).get();
        if (!exist.empty) {
          const doc = exist.docs[0];
          return res(200, { ok: true, id: doc.id, duplicada: true, msg: doc.data() });
        }
      }

      const criado_em = new Date(nowFn()).toISOString();
      const novaMsg = {
        viagem_id,
        de,
        nome_equipe,
        texto,
        id_local: id_local || null,
        criado_em,
        lida: de === 'equipe',
      };

      const ref = await msgsRef.add(novaMsg);

      // Atualiza resumo da última mensagem na viagem pai
      await db.collection(COLLECTION_VIAGENS).doc(viagem_id).set({
        ultima_mensagem: {
          texto: texto.slice(0, 100),
          de,
          criado_em,
        },
        atualizado_em: criado_em,
      }, { merge: true });

      return res(201, { ok: true, id: ref.id, msg: novaMsg });
    }

    // ── 2. msg_listar (Público/Passageiro ou Equipe) ─────────────────
    if (acao === 'msg_listar') {
      const viagem_id = str(method === 'GET' ? q.viagem_id : body.viagem_id, 80);
      if (!viagem_id) return res(400, { error: 'Informe o ID da viagem.' });

      const desde = str(method === 'GET' ? q.desde : body.desde, 50);
      const msgsRef = db.collection(COLLECTION_VIAGENS).doc(viagem_id).collection('mensagens');

      let query = msgsRef.orderBy('criado_em', 'asc');
      if (desde) {
        query = query.where('criado_em', '>', desde);
      }

      const snap = await query.limit(200).get();
      const mensagens = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Se a requisição for feita e houver flag marcar_lidas, atualiza mensagens de cliente para lidas
      if (body.marcar_lidas === true || q.marcar_lidas === '1') {
        const lote = db.batch();
        let mudou = false;
        for (const doc of snap.docs) {
          if (doc.data().de === 'cliente' && !doc.data().lida) {
            lote.update(doc.ref, { lida: true });
            mudou = true;
          }
        }
        if (mudou) await lote.commit();
      }

      return res(200, { ok: true, viagem_id, mensagens });
    }

    // ── 3. conversas_listar (Equipe / Painel Agência) ─────────────────
    if (acao === 'conversas_listar') {
      const vSnap = await db.collection(COLLECTION_VIAGENS).limit(100).get();
      const conversas = [];

      for (const vDoc of vSnap.docs) {
        const vData = vDoc.data();
        const mSnap = await vDoc.ref.collection('mensagens').get();
        const msgs = mSnap.docs.map(d => d.data());

        const nao_lidas = msgs.filter(m => m.de === 'cliente' && !m.lida).length;
        msgs.sort((a, b) => (a.criado_em || '').localeCompare(b.criado_em || ''));
        const ultima = msgs.length ? msgs[msgs.length - 1] : (vData.ultima_mensagem || null);

        conversas.push({
          viagem_id: vDoc.id,
          cliente_nome: vData.cliente_nome || vDoc.id,
          destino: vData.destino || '',
          status: vData.status || 'ativo',
          ultima_mensagem: ultima,
          nao_lidas,
        });
      }

      return res(200, { ok: true, conversas });
    }

    return res(400, { error: 'Ação desconhecida.' });
  };
}

exports.handler = createHandler();
exports.createHandler = createHandler;
