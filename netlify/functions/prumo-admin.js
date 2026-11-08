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
      const acao = body.acao || '';
      if (!acao) return res(400, { error: 'Ação não informada.' });

      const acao = body.acao || '';
      let result = {};

      // Implementação das rotas internas de gerenciamento
      if (acao === 'users') {
        // Gerenciamento de Usuários
        result = { ok: true, message: 'Gerenciamento de usuários.', users: [] }; // Exemplo: Retorna lista vazia por enquanto
      } else if (acao === 'plans') {
        // Gerenciamento de Planos
        result = { ok: true, message: 'Gerenciamento de planos.', plans: [] }; // Exemplo: Retorna lista vazia por enquanto
      } else if (acao === 'ia_consumption') {
        // Gerenciamento de Consumo IA
        result = { ok: true, message: 'Gerenciamento de consumo de IA.', consumption: {} }; // Exemplo: Retorna objeto vazio por enquanto
      } else if (acao === 'ocr_limits') {
        // Gerenciamento de Limites OCR
        result = { ok: true, message: 'Gerenciamento de limites OCR.', limits: {} }; // Exemplo: Retorna objeto vazio por enquanto
      } else if (acao === 'providers') {
        // Gerenciamento de Provedores
        result = { ok: true, message: 'Gerenciamento de provedores.', providers: [] }; // Exemplo: Retorna lista vazia por enquanto
      } else if (acao === 'errors') {
        // Gerenciamento de Erros
        result = { ok: true, message: 'Gerenciamento de erros.', errors: [] }; // Exemplo: Retorna lista vazia por enquanto
      } else if (acao === 'support') {
        // Gerenciamento de Suporte
        result = { ok: true, message: 'Gerenciamento de suporte.', support: {} }; // Exemplo: Retorna objeto vazio por enquanto
      } else if (acao === 'tech_logs') {
        // Gerenciamento de Logs Técnicos
        result = { ok: true, message: 'Gerenciamento de logs técnicos.', logs: [] }; // Exemplo: Retorna lista vazia por enquanto
      } else if (acao === 'availability') {
        // Gerenciamento de Disponibilidade
        result = { ok: true, message: 'Gerenciamento de disponibilidade.', availability: {} }; // Exemplo: Retorna objeto vazio por enquanto
      } else {
        return res(400, { error: `Ação desconhecida: ${acao}` });
      }

      // Retorna o resultado da ação processada
      return res(200, { ...result, received_at: new Date(now()).toISOString() });
    }

    // Se chegou aqui, é um método não suportado ou GET sem 'parte'
    if (method === 'GET') {
      const parte = q.parte || 'status';
      if (parte === 'status') {
        return res(200, {
          ok: true,
          admin: true,
          service: 'prumo-admin',
          timestamp: new Date(now()).toISOString(),
        });
      }
      // Caso GET com outra 'parte' que não seja 'status' e não seja tratada
      return res(404, { ok: false, message: `Parte '${parte}' não encontrada.` });
    }

    return res(400, { error: 'Ação ou método desconhecido.' });
  };
}

exports.handler = createHandler();
exports.createHandler = createHandler;
