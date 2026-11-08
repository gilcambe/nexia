'use strict';

// Kernex Finance (Prumo Admin) — API administrativa (/api/prumo-admin).
// Só o administrador da KERNEX (master) entra.
// Nunca grava em disco (sem fs.writeFileSync / require dinâmico).

function createHandler(deps = {}) {
  const getDb = deps.getDb || (() => require('./firebase-init').db);
  const getMw = deps.getMw || (() => require('./middleware'));
  const now = deps.now || (() => Date.now());

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

    const auth = headers.authorization ? await getMw().verifyBearerToken(event).catch(() => ({ ok: false })) : { ok: false };
    if (!auth.ok) return res(401, { error: 'Entre com sua conta.' });
    if (auth.role !== 'master') return res(403, { error: 'Só o administrador da KERNEX entra como master.' });

    let body = {};
    if (method === 'POST' && event.body) {
      try {
        body = JSON.parse(event.body);
      } catch {
        return res(400, { error: 'Pedido inválido.' });
      }
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) body = {};

    const q = event.queryStringParameters || {};

    if (method === 'GET') {
      const parte = q.parte || 'status';
      if (parte === 'status') {
        return res(200, {
          ok: true,
          admin: true,
          servico: 'prumo-admin',
          em: new Date(now()).toISOString(),
        });
      }
      return res(200, { ok: true, parte });
    }

    if (method === 'POST') {
      const acaoPost = body.acao || '';
      if (!acaoPost) return res(400, { error: 'Ação não informada.' });

      let resultPost = {};

      // Implementação das rotas internas de gerenciamento
      if (acaoPost === 'users') {
        // Gerenciamento de Usuários
        resultPost = { ok: true, message: 'Gerenciamento de usuários.', users: [] };
      } else if (acaoPost === 'plans') {
        // Gerenciamento de Planos
        resultPost = { ok: true, message: 'Gerenciamento de planos.', plans: [] };
      } else if (acaoPost === 'ia_consumption') {
        // Gerenciamento de Consumo IA
        resultPost = { ok: true, message: 'Gerenciamento de consumo de IA.', consumption: {} };
      } else if (acaoPost === 'ocr_limits') {
        // Gerenciamento de Limites OCR
        resultPost = { ok: true, message: 'Gerenciamento de limites OCR.', limits: {} };
      } else if (acaoPost === 'providers') {
        // Gerenciamento de Provedores
        resultPost = { ok: true, message: 'Gerenciamento de provedores.', providers: [] };
      } else if (acaoPost === 'errors') {
        // Gerenciamento de Erros
        resultPost = { ok: true, message: 'Gerenciamento de erros.', errors: [] };
      } else if (acaoPost === 'support') {
        // Gerenciamento de Suporte
        resultPost = { ok: true, message: 'Gerenciamento de suporte.', support: {} };
      } else if (acaoPost === 'tech_logs') {
        // Gerenciamento de Logs Técnicos
        resultPost = { ok: true, message: 'Gerenciamento de logs técnicos.', logs: [] };
      } else if (acaoPost === 'availability') {
        // Gerenciamento de Disponibilidade
        resultPost = { ok: true, message: 'Gerenciamento de disponibilidade.', availability: {} };
      } else {
        return res(400, { error: `Ação desconhecida: ${acaoPost}` });
      }

      // Retorna o resultado da ação processada
      return res(200, { ...resultPost, received_at: new Date(now()).toISOString() });
    }

    return res(400, { error: 'Ação ou método desconhecido.' });
  };
}

exports.handler = createHandler();
exports.createHandler = createHandler;
