'use strict';

const { verifyBearerToken, checkRateLimit, makeHeaders } = require('./middleware');

function validarItemCarteira(obj) {
  if (!obj || typeof obj !== 'object') {
    return { ok: false, erro: 'Item inválido.' };
  }
  const titulo = typeof obj.titulo === 'string' ? obj.titulo.trim() : '';
  if (!titulo) {
    return { ok: false, erro: 'O título é obrigatório.' };
  }
  const valor = Number(obj.valor);
  if (isNaN(valor)) {
    return { ok: false, erro: 'O valor deve ser um número válido.' };
  }
  return {
    ok: true,
    item: {
      id: typeof obj.id === 'string' && obj.id.trim() ? obj.id.trim() : Date.now().toString(),
      titulo,
      valor,
      categoria: typeof obj.categoria === 'string' ? obj.categoria.trim() : '',
      data: typeof obj.data === 'string' && obj.data.trim() ? obj.data.trim() : new Date().toISOString().slice(0, 10),
    },
  };
}

const resposta = (event, statusCode, body) => ({ statusCode, headers: makeHeaders(event), body: JSON.stringify(body) });

exports.validarItemCarteira = validarItemCarteira;

exports.handler = async (event) => {
  const method = String(event.httpMethod || '').toUpperCase();
  if (method === 'OPTIONS') return { statusCode: 204, headers: makeHeaders(event), body: '' };
  if (method !== 'POST') return resposta(event, 405, { error: 'Method Not Allowed' });

  const auth = await verifyBearerToken(event);
  if (!auth.ok) return resposta(event, 401, { error: 'Entre com sua conta.' });

  const rl = await checkRateLimit(auth.uid, 'prumo');
  if (!rl.ok) return resposta(event, 429, { error: 'Muitas requisições. Aguarde um instante.' });

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return resposta(event, 400, { error: 'Pedido inválido.' });
  }

  const acao = typeof body.acao === 'string' ? body.acao.trim() : '';
  if (!acao) {
    return resposta(event, 400, { error: 'A ação é obrigatória.' });
  }

  let db;
  try {
    const firebaseInit = require('./firebase-init');
    db = firebaseInit.db;
  } catch {
    db = null;
  }

  if (!db) {
    return resposta(event, 500, { error: 'Banco de dados indisponível.' });
  }

  const collectionRef = db.collection('prumo_carteiras').doc(auth.uid).collection('itens');

  try {
    if (acao === 'carteira_listar') {
      const snapshot = await collectionRef.get();
      const itens = [];
      snapshot.forEach((doc) => {
        itens.push({ id: doc.id, ...doc.data() });
      });
      return resposta(event, 200, { itens });
    }

    if (acao === 'carteira_salvar') {
      const validacao = validarItemCarteira(body.dados || body);
      if (!validacao.ok) {
        return resposta(event, 400, { error: validacao.erro });
      }
      const item = validacao.item;
      await collectionRef.doc(item.id).set(item, { merge: true });
      return resposta(event, 200, { ok: true, item });
    }

    if (acao === 'carteira_apagar') {
      const id = typeof body.id === 'string' ? body.id.trim() : '';
      if (!id) {
        return resposta(event, 400, { error: 'O ID do item é obrigatório para apagar.' });
      }
      await collectionRef.doc(id).delete();
      return resposta(event, 200, { ok: true, id });
    }

    return resposta(event, 400, { error: 'Ação desconhecida.' });
  } catch (err) {
    return resposta(event, 500, { error: 'Erro interno ao processar a requisição.' });
  }
};
