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

    // Suporte a rotas por query param (?parte=...) ou path ou body.acao
    const parte = q.parte || body.acao || (event.path || '').split('/').filter(Boolean).pop() || 'status';

    if (method === 'GET' || method === 'POST') {
      let result = {};

      if (parte === 'status') {
        return res(200, {
          ok: true,
          admin: true,
          servico: 'prumo-admin',
          em: new Date(now()).toISOString(),
        });
      } else if (parte === 'users') {
        result = { ok: true, users: [], count: 0, summary: 'Gerenciamento de usuários master' };
      } else if (parte === 'plans') {
        result = { ok: true, plans: [], summary: 'Gerenciamento de planos' };
      } else if (parte === 'ia_consumption' || parte === 'consumption') {
        result = { ok: true, consumption: { total_tokens: 0, requests: 0 }, summary: 'Consumo de IA' };
      } else if (parte === 'ocr_limits' || parte === 'limits') {
        result = { ok: true, limits: { daily_max: 1000, used: 0 }, summary: 'Limites OCR' };
      } else if (parte === 'providers') {
        result = { ok: true, providers: [{ name: 'anthropic', active: true }, { name: 'openai', active: true }], summary: 'Provedores IA' };
      } else if (parte === 'errors') {
        result = { ok: true, errors: [], count: 0, summary: 'Logs de erros' };
      } else if (parte === 'support') {
        result = { ok: true, tickets: [], count: 0, summary: 'Suporte técnico' };
      } else if (parte === 'tech_logs' || parte === 'logs') {
        result = { ok: true, logs: [], summary: 'Logs técnicos do sistema' };
      } else if (parte === 'availability') {
        result = { ok: true, availability: { status: 'operational', uptime: '99.9%' }, summary: 'Disponibilidade de serviços' };
      } else {
        return res(400, { error: `Endpoint desconhecido: ${parte}` });
      }

      return res(200, { ...result, received_at: new Date(now()).toISOString() });
    }

    return res(400, { error: 'Ação ou método desconhecido.' });
  };
}

exports.handler = createHandler();
exports.createHandler = createHandler;
